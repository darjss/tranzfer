import { getRuntimeEnv } from "@/server/lib/runtime";

export function getBillingProductIds() {
  const env = getRuntimeEnv();

  return {
    pro: env.POLAR_PRODUCT_PRO_ID || "",
  };
}
