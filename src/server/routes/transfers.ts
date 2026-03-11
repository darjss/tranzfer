import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
  DIRECT_UPLOAD_THRESHOLD_BYTES,
  MULTIPART_PART_SIZE_BYTES,
  type TransferFileDescriptor,
} from "@/lib/transfers";
import { getSessionFromHeaders } from "@/server/lib/auth";
import { getDb } from "@/server/db";
import { transferFile } from "@/server/db/schema";
import {
  createTransferDraft,
  getTransferForOwner,
  getReadyTransferBySlug,
  listTransfersForUser,
  logDownloadEvent,
  markFileUploaded,
  publishTransfer,
} from "@/server/lib/transfers";
import {
  completeMultipartUpload,
  createMultipartUpload,
  getSignedDownloadUrl,
  getSignedMultipartPartUrl,
  getSignedUploadUrl,
} from "@/server/lib/r2-s3";

type UploadUrlResponse =
  | {
      method: "PUT";
      mode: "single";
      url: string;
    }
  | {
      method: "PUT";
      mode: "multipart";
      partSizeBytes: number;
      parts: Array<{ partNumber: number; url: string }>;
      uploadId: string;
    };

async function requireSession(headers: Headers) {
  const session = await getSessionFromHeaders(headers);

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

function getHashedIp(headers: Headers) {
  const ipAddress = headers.get("CF-Connecting-IP");

  if (!ipAddress) {
    return null;
  }

  return crypto.createHash("sha256").update(ipAddress).digest("hex");
}

async function buildUploadResponse(file: typeof transferFile.$inferSelect) {
  if (file.sizeBytes <= DIRECT_UPLOAD_THRESHOLD_BYTES) {
    const url = await getSignedUploadUrl({
      contentType: file.contentType,
      key: file.objectKey,
    });

    return {
      method: "PUT",
      mode: "single",
      url: url.toString(),
    } satisfies UploadUrlResponse;
  }

  const db = getDb();
  const uploadId =
    file.multipartUploadId ||
    (await createMultipartUpload({
      contentType: file.contentType,
      key: file.objectKey,
    }));

  if (!file.multipartUploadId) {
    await db
      .update(transferFile)
      .set({
        multipartUploadId: uploadId,
        updatedAt: new Date(),
      })
      .where(eq(transferFile.id, file.id));
  }

  const partCount = Math.ceil(file.sizeBytes / MULTIPART_PART_SIZE_BYTES);
  const parts = await Promise.all(
    Array.from({ length: partCount }, (_, index) => {
      const partNumber = index + 1;

      return getSignedMultipartPartUrl({
        key: file.objectKey,
        partNumber,
        uploadId,
      }).then((url) => ({
        partNumber,
        url: url.toString(),
      }));
    }),
  );

  return {
    method: "PUT",
    mode: "multipart",
    partSizeBytes: MULTIPART_PART_SIZE_BYTES,
    parts,
    uploadId,
  } satisfies UploadUrlResponse;
}

function toPublicFile(file: typeof transferFile.$inferSelect): TransferFileDescriptor {
  return {
    contentType: file.contentType,
    id: file.id,
    originalName: file.originalName,
    sizeBytes: file.sizeBytes,
    status: file.status as TransferFileDescriptor["status"],
  };
}

async function handlePublicDownload(input: {
  fileId: string;
  headers: Headers;
  slug: string;
}) {
  const item = await getReadyTransferBySlug(input.slug);

  if (!item) {
    return {
      response: {
        error: "Transfer not found.",
      },
      status: 404,
    };
  }

  const file = item.files.find((entry) => entry.id === input.fileId);

  if (!file) {
    return {
      response: {
        error: "File not found.",
      },
      status: 404,
    };
  }

  await logDownloadEvent({
    fileId: file.id,
    ipHash: getHashedIp(input.headers),
    transferId: item.id,
    userAgent: input.headers.get("user-agent"),
  });

  return {
    response: Response.redirect(await getSignedDownloadUrl(file.objectKey), 302),
    status: 200,
  };
}

export const transferRoutes = new Elysia()
  .get("/transfers", async ({ request, set }) => {
    try {
      const session = await requireSession(request.headers);

      return listTransfersForUser(session.user.id);
    } catch (error) {
      set.status = 401;

      return {
        error: error instanceof Error ? error.message : "Unauthorized",
      };
    }
  })
  .post("/transfers", async ({ body, request, set }) => {
    try {
      const session = await requireSession(request.headers);
      const payload = (body ?? {}) as {
        files?: Array<{ contentType?: string | null; name?: string; sizeBytes?: number }>;
        message?: string | null;
        title?: string | null;
      };

      const transfer = await createTransferDraft(session.user.id, {
        files: (payload.files ?? []).map((file) => ({
          contentType: file.contentType ?? null,
          name: file.name ?? "",
          sizeBytes: file.sizeBytes ?? 0,
        })),
        message: payload.message ?? null,
        title: payload.title ?? null,
      });

      set.status = 201;

      return transfer;
    } catch (error) {
      set.status = error instanceof Error && error.message === "Unauthorized" ? 401 : 400;

      return {
        error: error instanceof Error ? error.message : "Could not create transfer.",
      };
    }
  })
  .post("/transfers/:transferId/files/:fileId/upload-url", async ({ params, request, set }) => {
    try {
      const session = await requireSession(request.headers);
      const ownedTransfer = await getTransferForOwner(session.user.id, params.transferId);

      if (!ownedTransfer) {
        throw new Error("Transfer not found.");
      }

      const file = ownedTransfer.files.find((item) => item.id === params.fileId);

      if (!file) {
        throw new Error("File not found.");
      }

      if (file.status === "uploaded") {
        throw new Error("This file is already uploaded.");
      }

      return {
        fileId: file.id,
        upload: await buildUploadResponse(file),
      };
    } catch (error) {
      set.status = error instanceof Error && error.message === "Unauthorized" ? 401 : 400;

      return {
        error: error instanceof Error ? error.message : "Could not prepare upload.",
      };
    }
  })
  .post("/transfers/:transferId/files/:fileId/complete", async ({ body, params, request, set }) => {
    try {
      const session = await requireSession(request.headers);
      const ownedTransfer = await getTransferForOwner(session.user.id, params.transferId);

      if (!ownedTransfer) {
        throw new Error("Transfer not found.");
      }

      const file = ownedTransfer.files.find((item) => item.id === params.fileId);

      if (!file) {
        throw new Error("File not found.");
      }

      const payload = (body ?? {}) as
        | { etag?: string | null; mode: "single" }
        | { mode: "multipart"; parts?: Array<{ etag?: string; partNumber?: number }> };

      if (payload.mode === "multipart") {
        if (!file.multipartUploadId) {
          throw new Error("Multipart upload was not initialized.");
        }

        const parts = (payload.parts ?? [])
          .map((part) => ({
            etag: part.etag?.trim() || "",
            partNumber: part.partNumber ?? 0,
          }))
          .filter((part) => part.partNumber > 0 && part.etag);

        if (parts.length === 0) {
          throw new Error("Multipart uploads need uploaded part metadata.");
        }

        await completeMultipartUpload({
          key: file.objectKey,
          parts,
          uploadId: file.multipartUploadId,
        });
      }

      await markFileUploaded({
        etag: payload.mode === "single" ? payload.etag ?? null : null,
        fileId: file.id,
        transferId: ownedTransfer.id,
      });

      if (payload.mode === "multipart" && file.multipartUploadId) {
        await getDb()
          .update(transferFile)
          .set({
            multipartUploadId: null,
            updatedAt: new Date(),
          })
          .where(eq(transferFile.id, file.id));
      }

      return {
        ok: true,
      };
    } catch (error) {
      set.status = error instanceof Error && error.message === "Unauthorized" ? 401 : 400;

      return {
        error: error instanceof Error ? error.message : "Could not finalize upload.",
      };
    }
  })
  .post("/transfers/:transferId/publish", async ({ params, request, set }) => {
    try {
      const session = await requireSession(request.headers);
      const nextTransfer = await publishTransfer(session.user.id, params.transferId);

      return {
        shareUrl: `/t/${nextTransfer?.slug}`,
        transfer: nextTransfer,
      };
    } catch (error) {
      set.status = error instanceof Error && error.message === "Unauthorized" ? 401 : 400;

      return {
        error: error instanceof Error ? error.message : "Could not publish transfer.",
      };
    }
  })
  .get("/public/transfers/:slug", async ({ params, set }) => {
    const item = await getReadyTransferBySlug(params.slug);

    if (!item) {
      set.status = 404;
      return {
        error: "Transfer not found.",
      };
    }

    return {
      expiresAt: item.expiresAt.toISOString(),
      files: item.files.map(toPublicFile),
      message: item.message,
      senderName: item.owner.name,
      slug: item.slug,
      title: item.title,
      totalBytes: item.totalBytes,
    };
  })
  .get("/public/transfers/:slug/files/:fileId/download", async ({ params, request, set }) => {
    const result = await handlePublicDownload({
      fileId: params.fileId,
      headers: request.headers,
      slug: params.slug,
    });

    set.status = result.status;

    return result.response;
  })
  .post("/public/transfers/:slug/files/:fileId/download", async ({ params, request, set }) => {
    const result = await handlePublicDownload({
      fileId: params.fileId,
      headers: request.headers,
      slug: params.slug,
    });

    set.status = result.status;

    return result.response;
  });
