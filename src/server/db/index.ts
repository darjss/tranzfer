import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/server/db/schema";
import { getRuntimeEnv } from "@/server/lib/runtime";

export function getDb() {
  return drizzle(getRuntimeEnv().DB, {
    schema,
  });
}
