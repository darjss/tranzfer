export const DEFAULT_TRANSFER_EXPIRY_DAYS = 7;
export const DIRECT_UPLOAD_THRESHOLD_BYTES = 100 * 1024 * 1024;
export const MULTIPART_PART_SIZE_BYTES = 25 * 1024 * 1024;
export const PRESIGNED_URL_TTL_SECONDS = 60 * 15;
export const SIGNED_DOWNLOAD_TTL_SECONDS = 60;

export const TRANSFER_STATUS_VALUES = [
  "draft",
  "uploading",
  "ready",
  "expired",
  "deleted",
  "failed",
] as const;

export const TRANSFER_FILE_STATUS_VALUES = [
  "pending",
  "uploaded",
  "failed",
  "deleted",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUS_VALUES)[number];
export type TransferFileStatus = (typeof TRANSFER_FILE_STATUS_VALUES)[number];

export const BLOCKED_FILE_EXTENSIONS = new Set([
  ".apk",
  ".app",
  ".bat",
  ".cmd",
  ".com",
  ".dll",
  ".dmg",
  ".exe",
  ".iso",
  ".jar",
  ".js",
  ".msi",
  ".ps1",
  ".reg",
  ".scr",
  ".sh",
  ".vbs",
]);

export type TransferFileDescriptor = {
  contentType: string | null;
  id: string;
  originalName: string;
  sizeBytes: number;
  status: TransferFileStatus;
};

export type TransferSummary = {
  createdAt: string;
  expiresAt: string;
  fileCount: number;
  files: TransferFileDescriptor[];
  id: string;
  message: string | null;
  slug: string;
  status: TransferStatus;
  title: string | null;
  totalBytes: number;
  uploadedBytes: number;
};

export type TransferListResponse = {
  entitlement: {
    activeStorageBytes: number;
    maxTransferBytes: number;
    plan: "free" | "pro";
    storageLimitBytes: number;
  };
  transfers: TransferSummary[];
};

export function getTransferExpiryDate(now = Date.now()) {
  return new Date(now + DEFAULT_TRANSFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export function isBlockedFileName(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const lastDotIndex = normalized.lastIndexOf(".");

  if (lastDotIndex < 0) {
    return false;
  }

  return BLOCKED_FILE_EXTENSIONS.has(normalized.slice(lastDotIndex));
}
