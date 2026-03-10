import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/server/db";
import { getRuntimeEnv } from "@/server/lib/runtime";
import * as schema from "@/server/db/schema";

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
  if (!baseUrl) return path;

  return new URL(path, baseUrl).toString();
}

function logPolarEvent(event: string, payload: unknown) {
  console.info(
    JSON.stringify({
      event,
      payload,
      source: "polar-webhook",
    }),
  );
}

export function getAuth() {
  const env = getRuntimeEnv();
  const polarServer = env.POLAR_SERVER === "production" ? "production" : "sandbox";
  const polarClient = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN || "",
    server: polarServer,
  });

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    ...(env.BETTER_AUTH_URL ? { baseURL: env.BETTER_AUTH_URL } : {}),
    basePath: "/auth",
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
        createCustomerOnSignUp: true,
        getCustomerCreateParams: async ({ user }) =>
          ({
            externalId: user.id,
          }) as unknown as { metadata?: Record<string, string | number | boolean> },
        use: [
          checkout({
            authenticatedUsersOnly: true,
            products: [
              {
                productId: env.POLAR_PRODUCT_STARTER_ID || "",
                slug: "starter",
              },
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
            secret: env.POLAR_WEBHOOK_SECRET || "",
            onCustomerStateChanged: async (payload) => {
              logPolarEvent("customer.state_changed", payload);
            },
            onOrderPaid: async (payload) => {
              logPolarEvent("order.paid", payload);
            },
            onPayload: async (payload) => {
              logPolarEvent("payload", payload);
            },
            onSubscriptionActive: async (payload) => {
              logPolarEvent("subscription.active", payload);
            },
            onSubscriptionCanceled: async (payload) => {
              logPolarEvent("subscription.canceled", payload);
            },
            onSubscriptionUpdated: async (payload) => {
              logPolarEvent("subscription.updated", payload);
            },
          }),
        ],
      }),
    ],
    trustedOrigins: getTrustedOrigins(),
  });
}
