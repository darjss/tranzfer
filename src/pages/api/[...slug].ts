import type { APIRoute } from "astro";

export const prerender = false;

function logApiError(phase: string, pathname: string, error: unknown) {
  console.error(`[api:${phase}] ${pathname}`, error);

  if (error instanceof Error) {
    console.error(`[api:${phase}:message] ${pathname}`, error.message);

    if (error.stack) {
      console.error(`[api:${phase}:stack] ${pathname}\n${error.stack}`);
    }
  }
}

function stripApiPrefix(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/^\/api(?=\/|$)/, "");

  url.pathname = pathname.length > 0 ? pathname : "/";

  return new Request(url, request);
}

export const ALL: APIRoute = async ({ request }) => {
  const apiRequest = stripApiPrefix(request);
  const pathname = new URL(request.url).pathname;

  if (pathname === "/api/health") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json",
      },
      status: 200,
    });
  }

  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return import("@/server/lib/auth").then(({ getAuth }) => getAuth().handler(request));
  }

  return import("@/server/app")
    .catch((error) => {
      logApiError("import-app", pathname, error);
      throw error;
    })
    .then(({ app }) => {
      return Promise.resolve(app.handle(apiRequest)).catch((error) => {
        logApiError("handle-app", pathname, error);
        throw error;
      });
    });
};
