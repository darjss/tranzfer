import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userEntitlement = sqliteTable(
  "user_entitlement",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"),
    source: text("source").notNull().default("default"),
    polarCustomerId: text("polar_customer_id"),
    polarProductId: text("polar_product_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_entitlement_plan_idx").on(table.plan)],
);

export const transfer = sqliteTable(
  "transfer",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    message: text("message"),
    status: text("status").notNull().default("draft"),
    totalBytes: integer("total_bytes").notNull().default(0),
    uploadedBytes: integer("uploaded_bytes").notNull().default(0),
    fileCount: integer("file_count").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("transfer_owner_user_id_idx").on(table.ownerUserId),
    index("transfer_status_idx").on(table.status),
    index("transfer_expires_at_idx").on(table.expiresAt),
  ],
);

export const transferFile = sqliteTable(
  "transfer_file",
  {
    id: text("id").primaryKey(),
    transferId: text("transfer_id")
      .notNull()
      .references(() => transfer.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    status: text("status").notNull().default("pending"),
    multipartUploadId: text("multipart_upload_id"),
    etag: text("etag"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("transfer_file_transfer_id_idx").on(table.transferId),
    index("transfer_file_status_idx").on(table.status),
  ],
);

export const transferDownloadEvent = sqliteTable(
  "transfer_download_event",
  {
    id: text("id").primaryKey(),
    transferId: text("transfer_id")
      .notNull()
      .references(() => transfer.id, { onDelete: "cascade" }),
    transferFileId: text("transfer_file_id")
      .notNull()
      .references(() => transferFile.id, { onDelete: "cascade" }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("transfer_download_event_transfer_id_idx").on(table.transferId),
    index("transfer_download_event_file_id_idx").on(table.transferFileId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
  transfers: many(transfer),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userEntitlementRelations = relations(userEntitlement, ({ one }) => ({
  user: one(user, {
    fields: [userEntitlement.userId],
    references: [user.id],
  }),
}));

export const transferRelations = relations(transfer, ({ many, one }) => ({
  files: many(transferFile),
  owner: one(user, {
    fields: [transfer.ownerUserId],
    references: [user.id],
  }),
}));

export const transferFileRelations = relations(transferFile, ({ many, one }) => ({
  downloads: many(transferDownloadEvent),
  transfer: one(transfer, {
    fields: [transferFile.transferId],
    references: [transfer.id],
  }),
}));

export const transferDownloadEventRelations = relations(
  transferDownloadEvent,
  ({ one }) => ({
    file: one(transferFile, {
      fields: [transferDownloadEvent.transferFileId],
      references: [transferFile.id],
    }),
    transfer: one(transfer, {
      fields: [transferDownloadEvent.transferId],
      references: [transfer.id],
    }),
  }),
);
