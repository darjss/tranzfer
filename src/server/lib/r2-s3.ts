import { AwsClient } from "aws4fetch";
import { PRESIGNED_URL_TTL_SECONDS, SIGNED_DOWNLOAD_TTL_SECONDS } from "@/lib/transfers";
import { getRuntimeEnv } from "@/server/lib/runtime";

type MultipartPart = {
  etag: string;
  partNumber: number;
};

function getAwsClient() {
  const env = getRuntimeEnv();

  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing R2 API credentials.");
  }

  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    region: "auto",
    retries: 0,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
  });
}

function getBucketApiUrl(key = "") {
  const env = getRuntimeEnv();

  if (!env.R2_ACCOUNT_ID || !env.R2_BUCKET_NAME) {
    throw new Error("Missing R2 bucket configuration.");
  }

  const normalizedKey = key.startsWith("/") ? key.slice(1) : key;

  return new URL(
    normalizedKey,
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/`,
  );
}

export async function getSignedUploadUrl(input: {
  contentType?: string | null;
  key: string;
}) {
  const aws = getAwsClient();
  const url = getBucketApiUrl(input.key);
  url.searchParams.set("X-Amz-Expires", String(PRESIGNED_URL_TTL_SECONDS));

  const request = await aws.sign(url, {
    aws: {
      allHeaders: true,
      signQuery: true,
    },
    headers: input.contentType ? { "content-type": input.contentType } : undefined,
    method: "PUT",
  });

  return request.url;
}

export async function createMultipartUpload(input: {
  contentType?: string | null;
  key: string;
}) {
  const aws = getAwsClient();
  const url = getBucketApiUrl(input.key);
  url.searchParams.set("uploads", "");

  const response = await aws.fetch(url, {
    headers: input.contentType ? { "content-type": input.contentType } : undefined,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Could not create multipart upload.");
  }

  const responseText = await response.text();
  const uploadId = responseText.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];

  if (!uploadId) {
    throw new Error("Multipart upload did not return an upload ID.");
  }

  return uploadId;
}

export async function getSignedMultipartPartUrl(input: {
  key: string;
  partNumber: number;
  uploadId: string;
}) {
  const aws = getAwsClient();
  const url = getBucketApiUrl(input.key);
  url.searchParams.set("X-Amz-Expires", String(PRESIGNED_URL_TTL_SECONDS));
  url.searchParams.set("partNumber", String(input.partNumber));
  url.searchParams.set("uploadId", input.uploadId);

  const request = await aws.sign(url, {
    aws: {
      signQuery: true,
    },
    method: "PUT",
  });

  return request.url;
}

export async function completeMultipartUpload(input: {
  key: string;
  parts: MultipartPart[];
  uploadId: string;
}) {
  const aws = getAwsClient();
  const url = getBucketApiUrl(input.key);
  url.searchParams.set("uploadId", input.uploadId);

  const body = [
    "<CompleteMultipartUpload>",
    ...input.parts.map((part) => {
      return `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag}</ETag></Part>`;
    }),
    "</CompleteMultipartUpload>",
  ].join("");

  const response = await aws.fetch(url, {
    body,
    headers: {
      "content-type": "application/xml",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Could not finalize multipart upload.");
  }

  return response.text();
}

export async function getSignedDownloadUrl(key: string) {
  const aws = getAwsClient();
  const url = getBucketApiUrl(key);
  url.searchParams.set("X-Amz-Expires", String(SIGNED_DOWNLOAD_TTL_SECONDS));

  const request = await aws.sign(url, {
    aws: {
      signQuery: true,
    },
    method: "GET",
  });

  return request.url;
}

export async function deleteObject(key: string) {
  const aws = getAwsClient();
  const response = await aws.fetch(getBucketApiUrl(key), {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not delete object ${key}.`);
  }
}
