import { createId, init } from "@paralleldrive/cuid2";
import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import {
  type TransferFileDescriptor,
  type TransferListResponse,
  type TransferSummary,
  getTransferExpiryDate,
  isBlockedFileName,
} from "@/lib/transfers";
import { PLAN_CATALOG, formatBytes } from "@/lib/billing/plans";
import { getDb } from "@/server/db";
import { transfer, transferDownloadEvent, transferFile } from "@/server/db/schema";
import { getUserPlan } from "@/server/lib/entitlements";

const slugId = init({
  length: 10,
});

const ACTIVE_TRANSFER_STATUSES = ["draft", "uploading", "ready"] as const;

export type CreateTransferInput = {
  files: Array<{
    contentType?: string | null;
    name: string;
    sizeBytes: number;
  }>;
  message?: string | null;
  title?: string | null;
};

export async function getActiveStorageBytes(userId: string) {
  const db = getDb();
  const result = await db
    .select({
      totalBytes: sql<number>`coalesce(sum(${transfer.totalBytes}), 0)`,
    })
    .from(transfer)
    .where(
      and(
        eq(transfer.ownerUserId, userId),
        inArray(transfer.status, ACTIVE_TRANSFER_STATUSES),
        gt(transfer.expiresAt, new Date()),
      ),
    );

  return Number(result[0]?.totalBytes ?? 0);
}

export async function listTransfersForUser(userId: string): Promise<TransferListResponse> {
  const db = getDb();
  const { definition, plan } = await getUserPlan(userId);
  const transfers = await db.query.transfer.findMany({
    orderBy: [desc(transfer.createdAt)],
    where: eq(transfer.ownerUserId, userId),
    with: {
      files: {
        orderBy: [desc(transferFile.createdAt)],
      },
    },
  });

  const activeStorageBytes = await getActiveStorageBytes(userId);

  return {
    entitlement: {
      activeStorageBytes,
      maxTransferBytes: definition.limits.maxTransferBytes,
      plan,
      storageLimitBytes: definition.limits.activeStorageBytes,
    },
    transfers: transfers.map(toTransferSummary),
  };
}

export async function createTransferDraft(userId: string, input: CreateTransferInput) {
  const db = getDb();
  const { definition, plan } = await getUserPlan(userId);
  const activeStorageBytes = await getActiveStorageBytes(userId);
  const normalizedFiles = input.files.map((file) => ({
    contentType: file.contentType?.trim() || null,
    name: file.name.trim(),
    sizeBytes: Math.max(0, Math.floor(file.sizeBytes)),
  }));

  if (normalizedFiles.length === 0) {
    throw new Error("Select at least one file.");
  }

  const totalBytes = normalizedFiles.reduce((sum, file) => sum + file.sizeBytes, 0);

  if (totalBytes <= 0) {
    throw new Error("Files must have a size greater than zero.");
  }

  if (totalBytes > definition.limits.maxTransferBytes) {
    throw new Error(
      `${definition.name} supports transfers up to ${formatBytes(definition.limits.maxTransferBytes)}.`,
    );
  }

  if (activeStorageBytes + totalBytes > definition.limits.activeStorageBytes) {
    throw new Error("This transfer would exceed your active storage allowance.");
  }

  for (const file of normalizedFiles) {
    if (!file.name) {
      throw new Error("Every file needs a name.");
    }

    if (isBlockedFileName(file.name)) {
      throw new Error(`Blocked file type: ${file.name}`);
    }
  }

  const nextTransferId = createId();
  const slug = slugId();
  const expiresAt = getTransferExpiryDate();

  await db.insert(transfer).values({
    expiresAt,
    fileCount: normalizedFiles.length,
    id: nextTransferId,
    message: input.message?.trim() || null,
    ownerUserId: userId,
    slug,
    status: "uploading",
    title: input.title?.trim() || null,
    totalBytes,
    uploadedBytes: 0,
  });

  const nextFiles = normalizedFiles.map((file, index) => {
    const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";

    return {
      contentType: file.contentType,
      id: createId(),
      objectKey: `${userId}/${nextTransferId}/${index + 1}-${createId()}${extension.toLowerCase()}`,
      originalName: file.name,
      sizeBytes: file.sizeBytes,
      status: "pending" as const,
      transferId: nextTransferId,
    };
  });

  await db.insert(transferFile).values(nextFiles);

  const createdTransfer = await db.query.transfer.findFirst({
    where: eq(transfer.id, nextTransferId),
    with: {
      files: {
        orderBy: [asc(transferFile.createdAt)],
      },
    },
  });

  if (!createdTransfer) {
    throw new Error("Could not create the transfer.");
  }

  return {
    plan,
    transfer: toTransferSummary(createdTransfer),
  };
}

export async function getTransferForOwner(userId: string, transferId: string) {
  const db = getDb();

  return db.query.transfer.findFirst({
    where: and(eq(transfer.id, transferId), eq(transfer.ownerUserId, userId)),
    with: {
      files: {
        orderBy: [asc(transferFile.createdAt)],
      },
    },
  });
}

export async function getReadyTransferBySlug(slug: string) {
  const db = getDb();

  return db.query.transfer.findFirst({
    where: and(
      eq(transfer.slug, slug),
      eq(transfer.status, "ready"),
      gt(transfer.expiresAt, new Date()),
    ),
    with: {
      owner: true,
      files: {
        orderBy: [asc(transferFile.createdAt)],
        where: eq(transferFile.status, "uploaded"),
      },
    },
  });
}

export async function markFileUploaded(input: {
  etag: string | null;
  fileId: string;
  transferId: string;
}) {
  const db = getDb();

  await db
    .update(transferFile)
    .set({
      completedAt: new Date(),
      etag: input.etag,
      status: "uploaded",
      updatedAt: new Date(),
    })
    .where(and(eq(transferFile.id, input.fileId), eq(transferFile.transferId, input.transferId)));

  const files = await db.query.transferFile.findMany({
    where: eq(transferFile.transferId, input.transferId),
  });
  const uploadedBytes = files
    .filter((file) => file.status === "uploaded")
    .reduce((sum, file) => sum + file.sizeBytes, 0);

  await db
    .update(transfer)
    .set({
      status: uploadedBytes > 0 ? "uploading" : "draft",
      updatedAt: new Date(),
      uploadedBytes,
    })
    .where(eq(transfer.id, input.transferId));
}

export async function publishTransfer(userId: string, transferId: string) {
  const db = getDb();
  const ownedTransfer = await getTransferForOwner(userId, transferId);

  if (!ownedTransfer) {
    throw new Error("Transfer not found.");
  }

  if (ownedTransfer.files.some((file) => file.status !== "uploaded")) {
    throw new Error("Upload every file before publishing the transfer.");
  }

  await db
    .update(transfer)
    .set({
      publishedAt: new Date(),
      status: "ready",
      updatedAt: new Date(),
      uploadedBytes: ownedTransfer.totalBytes,
    })
    .where(eq(transfer.id, transferId));

  return getTransferForOwner(userId, transferId);
}

export async function logDownloadEvent(input: {
  fileId: string;
  ipHash: string | null;
  transferId: string;
  userAgent: string | null;
}) {
  const db = getDb();

  await db.insert(transferDownloadEvent).values({
    id: createId(),
    ipHash: input.ipHash,
    transferFileId: input.fileId,
    transferId: input.transferId,
    userAgent: input.userAgent,
  });
}

export async function expireTransfers(now = new Date()) {
  const db = getDb();
  const expiredTransfers = await db.query.transfer.findMany({
    where: and(
      inArray(transfer.status, ["draft", "uploading", "ready"]),
      lt(transfer.expiresAt, now),
    ),
    with: {
      files: true,
    },
  });

  if (expiredTransfers.length === 0) {
    return [];
  }

  await db
    .update(transfer)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      inArray(
        transfer.id,
        expiredTransfers.map((item) => item.id),
      ),
    );

  return expiredTransfers;
}

export function toTransferSummary(
  item: typeof transfer.$inferSelect & { files: Array<typeof transferFile.$inferSelect> },
): TransferSummary {
  return {
    createdAt: item.createdAt.toISOString(),
    expiresAt: item.expiresAt.toISOString(),
    fileCount: item.fileCount,
    files: item.files.map(toTransferFileDescriptor),
    id: item.id,
    message: item.message,
    slug: item.slug,
    status: item.status as TransferSummary["status"],
    title: item.title,
    totalBytes: item.totalBytes,
    uploadedBytes: item.uploadedBytes,
  };
}

function toTransferFileDescriptor(item: typeof transferFile.$inferSelect): TransferFileDescriptor {
  return {
    contentType: item.contentType,
    id: item.id,
    originalName: item.originalName,
    sizeBytes: item.sizeBytes,
    status: item.status as TransferFileDescriptor["status"],
  };
}

export function getPlanLimits(plan: "free" | "pro") {
  return PLAN_CATALOG[plan].limits;
}
