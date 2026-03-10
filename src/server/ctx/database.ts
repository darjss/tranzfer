import { Elysia } from "elysia";
import { getDb } from "@/server/db";

export const database = new Elysia({ name: "@[database]" }).decorate(
  "getDb",
  getDb,
);
