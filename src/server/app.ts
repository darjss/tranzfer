import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { Elysia } from "elysia";
import { betterAuthPlugin } from "@/server/ctx/better-auth";
import { cfBindings } from "@/server/ctx/cf-bindings";

export const app = new Elysia({
  adapter: CloudflareAdapter,
})
  .use(cfBindings)
  .use(betterAuthPlugin)
  .get("/", () => ({
    ok: true,
    service: "api",
  }))
  .get("/health", () => ({
    ok: true,
  }))
  .compile();
