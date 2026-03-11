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
        GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
        POLAR_ACCESS_TOKEN: env.POLAR_ACCESS_TOKEN,
        POLAR_PRODUCT_PRO_ID: env.POLAR_PRODUCT_PRO_ID,
        POLAR_SERVER: env.POLAR_SERVER,
        POLAR_WEBHOOK_SECRET: env.POLAR_WEBHOOK_SECRET,
        R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
        R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
        R2_BUCKET_NAME: env.R2_BUCKET_NAME,
        R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
        SESSION: env.SESSION,
        TRUSTED_ORIGINS: env.TRUSTED_ORIGINS,
      };
    },
  },
);
