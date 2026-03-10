import { Elysia } from "elysia";
import { getRuntimeEnv } from "@/server/lib/runtime";

export const cfBindings = new Elysia({ name: "@[cf-bindings]" }).decorate(
  "cf",
  {
    get env() {
      return getRuntimeEnv();
    },
    get bindings() {
      const env = getRuntimeEnv();

      return {
        DB: env.DB,
        BUCKET: env.BUCKET,
        CACHE: env.CACHE,
        BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: env.BETTER_AUTH_URL,
        POLAR_ACCESS_TOKEN: env.POLAR_ACCESS_TOKEN,
        POLAR_PRODUCT_PRO_ID: env.POLAR_PRODUCT_PRO_ID,
        POLAR_PRODUCT_STARTER_ID: env.POLAR_PRODUCT_STARTER_ID,
        POLAR_SERVER: env.POLAR_SERVER,
        POLAR_WEBHOOK_SECRET: env.POLAR_WEBHOOK_SECRET,
        TRUSTED_ORIGINS: env.TRUSTED_ORIGINS,
      };
    },
  },
);
