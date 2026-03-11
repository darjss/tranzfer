import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/server/db";
import * as schema from "@/server/db/schema";
import { syncEntitlementFromCustomerState } from "@/server/lib/entitlements";
import { getRuntimeEnv } from "@/server/lib/runtime";

function getTrustedOrigins() {
  const env = getRuntimeEnv();

  return Array.from(
    new Set(
      [env.BETTER_AUTH_URL, env.TRUSTED_ORIGINS]
        .filter((value): value is string => Boolean(value))
        .flatMap((value) =>
          value
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean),
        ),
    ),
  );
}

function toAbsoluteUrl(path: string, baseUrl?: string) {
  if (!baseUrl) {
    return path;
  }

  return new URL(path, baseUrl).toString();
}

function shouldCreatePolarCustomerOnSignUp(baseUrl?: string) {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname;

    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

export function getAuth() {
  const env = getRuntimeEnv();
  const polarServer = env.POLAR_SERVER === "production" ? "production" : "sandbox";
  const createPolarCustomerOnSignUp = shouldCreatePolarCustomerOnSignUp(
    env.BETTER_AUTH_URL,
  );
  const polarClient = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN || "",
    server: polarServer,
  });

  return betterAuth({
    ...(env.BETTER_AUTH_URL ? { baseURL: env.BETTER_AUTH_URL } : {}),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          socialProviders: {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          },
        }
      : {}),
    basePath: "/api/auth",
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    plugins: [
      polar({
        client: polarClient,
        createCustomerOnSignUp: createPolarCustomerOnSignUp,
        getCustomerCreateParams: async ({ user }) =>
          ({
            externalId: user.id,
          }) as unknown as { metadata?: Record<string, string | number | boolean> },
        use: [
          checkout({
            authenticatedUsersOnly: true,
            products: [
              {
                productId: env.POLAR_PRODUCT_PRO_ID || "",
                slug: "pro",
              },
            ],
            returnUrl: toAbsoluteUrl("/pricing", env.BETTER_AUTH_URL),
            successUrl: toAbsoluteUrl(
              "/billing/success?checkout_id={CHECKOUT_ID}",
              env.BETTER_AUTH_URL,
            ),
          }),
          portal({
            returnUrl: toAbsoluteUrl("/account/billing", env.BETTER_AUTH_URL),
          }),
          webhooks({
            onCustomerStateChanged: async (payload) => {
              await syncEntitlementFromCustomerState(payload.data);
            },
            onPayload: async () => undefined,
            secret: env.POLAR_WEBHOOK_SECRET || "",
          }),
        ],
      }),
    ],
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: getTrustedOrigins(),
  });
}

export async function getSessionFromHeaders(headers: Headers) {
  return getAuth().api.getSession({
    headers,
  });
}
