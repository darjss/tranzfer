import { defineMiddleware } from "astro:middleware";
import { ensureUserEntitlement } from "@/server/lib/entitlements";
import { getSessionFromHeaders } from "@/server/lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.hostname === "www.tranzfer.app") {
    const redirectUrl = new URL(context.request.url);
    redirectUrl.hostname = "tranzfer.app";

    return Response.redirect(redirectUrl, 308);
  }

  if (context.url.pathname === "/api" || context.url.pathname.startsWith("/api/")) {
    return next();
  }

  const session = await getSessionFromHeaders(context.request.headers);

  context.locals.session = session?.session ?? null;
  context.locals.user = session?.user ?? null;

  if (session?.user?.id) {
    await ensureUserEntitlement(session.user.id);
  }

  return next();
});
