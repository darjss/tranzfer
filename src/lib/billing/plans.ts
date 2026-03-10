export type PlanKey = "none" | "starter" | "pro";
export type PaidPlanKey = Exclude<PlanKey, "none">;

export type PlanLimits = {
  seats: number | null;
  workspaces: number | null;
};

export type PlanDefinition = {
  key: PlanKey;
  slug: Exclude<PlanKey, "none"> | null;
  name: string;
  priceMonthly: number | null;
  limits: PlanLimits;
  marketingBullets: string[];
  polarProductEnvKey: string | null;
};

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  none: {
    key: "none",
    slug: null,
    name: "No active subscription",
    priceMonthly: null,
    limits: {
      seats: null,
      workspaces: null,
    },
    marketingBullets: [
      "No active Polar subscription",
      "Upgrade to unlock recurring billing",
      "Manage purchases after checkout",
    ],
    polarProductEnvKey: null,
  },
  starter: {
    key: "starter",
    slug: "starter",
    name: "Starter",
    priceMonthly: 9,
    limits: {
      seats: 5,
      workspaces: 1,
    },
    marketingBullets: [
      "1 workspace included",
      "Up to 5 seats",
      "Standard email support",
    ],
    polarProductEnvKey: "POLAR_PRODUCT_STARTER_ID",
  },
  pro: {
    key: "pro",
    slug: "pro",
    name: "Pro",
    priceMonthly: 29,
    limits: {
      seats: 25,
      workspaces: 10,
    },
    marketingBullets: [
      "10 workspaces included",
      "Up to 25 seats",
      "Priority support",
    ],
    polarProductEnvKey: "POLAR_PRODUCT_PRO_ID",
  },
};

export const PAID_PLAN_KEYS = ["starter", "pro"] as const satisfies readonly PaidPlanKey[];

export function getPlanDefinition(key: PlanKey) {
  return PLAN_CATALOG[key];
}
