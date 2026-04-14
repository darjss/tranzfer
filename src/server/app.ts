import { Elysia } from "elysia";
import { cfBindings } from "@/server/ctx/cf-bindings";
import { transferRoutes } from "@/server/routes/transfers";

export const app = new Elysia({
  // Astro endpoints call Elysia through app.handle(request), not as the
  // Worker entrypoint itself. Keep Elysia on the generic WinterTC path so
  // Cloudflare doesn't try to JIT-compile handlers during route module import.
  aot: false,
})
  .use(cfBindings)
  .use(transferRoutes)
  .get("/", () => ({
    ok: true,
    service: "api",
  }))
  .get("/health", () => ({
    ok: true,
  }));
