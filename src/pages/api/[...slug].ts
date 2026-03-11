import type { APIRoute } from "astro";
import { app } from "@/server/app";
import type { Runtime } from "@astrojs/cloudflare";
import type { CloudflareEnv } from "../../../types/env";
import { getAuth } from "@/server/lib/auth";
import { runWithRuntime } from "@/server/lib/runtime";

export const prerender = false;

function stripApiPrefix(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/^\/api(?=\/|$)/, "");

  url.pathname = pathname.length > 0 ? pathname : "/";

  return new Request(url, request);
}

export const ALL: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as unknown as Runtime<CloudflareEnv>).runtime;

  return runWithRuntime(runtime, () => {
    const pathname = new URL(request.url).pathname;

    if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
      return getAuth().handler(request);
    }

    const apiRequest = stripApiPrefix(request);
    return app.handle(apiRequest);
  });
};
