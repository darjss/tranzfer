import { env } from "cloudflare:workers";

export function getBillingProductIds() {
  return {
    pro: env.POLAR_PRODUCT_PRO_ID || "",
  };
}
