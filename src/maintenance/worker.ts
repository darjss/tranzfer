import { and, inArray, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/server/db/schema";

type MaintenanceEnv = {
  BUCKET: R2Bucket;
  DB: D1Database;
};

const EXPIRABLE_STATUSES = ["draft", "uploading", "ready"] as const;

export default {
  async scheduled(_controller: ScheduledController, env: MaintenanceEnv) {
    const db = drizzle(env.DB, {
      schema,
    });
    const expiredTransfers = await db.query.transfer.findMany({
      where: and(
        inArray(schema.transfer.status, EXPIRABLE_STATUSES),
        lt(schema.transfer.expiresAt, new Date()),
      ),
      with: {
        files: true,
      },
    });

    if (expiredTransfers.length === 0) {
      return;
    }

    for (const expiredTransfer of expiredTransfers) {
      for (const file of expiredTransfer.files) {
        await env.BUCKET.delete(file.objectKey);
      }
    }

    await db
      .update(schema.transfer)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(
        inArray(
          schema.transfer.id,
          expiredTransfers.map((item) => item.id),
        ),
      );

    await db
      .update(schema.transferFile)
      .set({
        multipartUploadId: null,
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(
        inArray(
          schema.transferFile.transferId,
          expiredTransfers.map((item) => item.id),
        ),
      );
  },
};
