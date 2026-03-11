CREATE TABLE `user_entitlement` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `plan` text DEFAULT 'free' NOT NULL,
  `source` text DEFAULT 'default' NOT NULL,
  `polar_customer_id` text,
  `polar_product_id` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_entitlement_user_id_unique` ON `user_entitlement` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_entitlement_plan_idx` ON `user_entitlement` (`plan`);
--> statement-breakpoint
CREATE TABLE `transfer` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `owner_user_id` text NOT NULL,
  `title` text,
  `message` text,
  `status` text DEFAULT 'draft' NOT NULL,
  `total_bytes` integer DEFAULT 0 NOT NULL,
  `uploaded_bytes` integer DEFAULT 0 NOT NULL,
  `file_count` integer DEFAULT 0 NOT NULL,
  `expires_at` integer NOT NULL,
  `published_at` integer,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transfer_slug_unique` ON `transfer` (`slug`);
--> statement-breakpoint
CREATE INDEX `transfer_owner_user_id_idx` ON `transfer` (`owner_user_id`);
--> statement-breakpoint
CREATE INDEX `transfer_status_idx` ON `transfer` (`status`);
--> statement-breakpoint
CREATE INDEX `transfer_expires_at_idx` ON `transfer` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `transfer_file` (
  `id` text PRIMARY KEY NOT NULL,
  `transfer_id` text NOT NULL,
  `object_key` text NOT NULL,
  `original_name` text NOT NULL,
  `content_type` text,
  `size_bytes` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `multipart_upload_id` text,
  `etag` text,
  `completed_at` integer,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`transfer_id`) REFERENCES `transfer`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transfer_file_object_key_unique` ON `transfer_file` (`object_key`);
--> statement-breakpoint
CREATE INDEX `transfer_file_transfer_id_idx` ON `transfer_file` (`transfer_id`);
--> statement-breakpoint
CREATE INDEX `transfer_file_status_idx` ON `transfer_file` (`status`);
--> statement-breakpoint
CREATE TABLE `transfer_download_event` (
  `id` text PRIMARY KEY NOT NULL,
  `transfer_id` text NOT NULL,
  `transfer_file_id` text NOT NULL,
  `ip_hash` text,
  `user_agent` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`transfer_id`) REFERENCES `transfer`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`transfer_file_id`) REFERENCES `transfer_file`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transfer_download_event_transfer_id_idx` ON `transfer_download_event` (`transfer_id`);
--> statement-breakpoint
CREATE INDEX `transfer_download_event_file_id_idx` ON `transfer_download_event` (`transfer_file_id`);
