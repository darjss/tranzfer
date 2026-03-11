import { defineMiddleware } from "astro:middleware";
import type { Runtime } from "@astrojs/cloudflare";
import type { CloudflareEnv } from "../types/env";
import { ensureUserEntitlement } from "@/server/lib/entitlements";
import { getSessionFromHeaders } from "@/server/lib/auth";
import { runWithRuntime } from "@/server/lib/runtime";

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.hostname === "www.tranzfer.app") {
    const redirectUrl = new URL(context.request.url);
    redirectUrl.hostname = "tranzfer.app";

    return Response.redirect(redirectUrl, 308);
  }

  const runtime = (context.locals as unknown as Runtime<CloudflareEnv>).runtime;

  return runWithRuntime(runtime, async () => {
    const session = await getSessionFromHeaders(context.request.headers);

    context.locals.session = session?.session ?? null;
    context.locals.user = session?.user ?? null;

    if (session?.user?.id) {
      await ensureUserEntitlement(session.user.id);
    }

    return next();
  });
});
