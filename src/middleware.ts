import { defineMiddleware } from "astro:middleware";
import type { Runtime } from "@astrojs/cloudflare";
import type { CloudflareEnv } from "../types/env";
import { getAuth } from "@/server/lib/auth";
import { runWithRuntime } from "@/server/lib/runtime";

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = (context.locals as unknown as Runtime<CloudflareEnv>).runtime;

  return runWithRuntime(runtime, async () => {
    const session = await getAuth().api.getSession({
      headers: context.request.headers,
    });

    context.locals.session = session?.session ?? null;
    context.locals.user = session?.user ?? null;

    return next();
  });
});
