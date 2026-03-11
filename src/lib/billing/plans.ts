export type PlanKey = "free" | "pro";
export type PaidPlanKey = Extract<PlanKey, "pro">;

export type PlanLimits = {
  activeStorageBytes: number;
  maxTransferBytes: number;
  retentionDays: number;
};

export type PlanDefinition = {
  key: PlanKey;
  slug: PaidPlanKey | null;
  name: string;
  priceMonthly: number | null;
  limits: PlanLimits;
  marketingBullets: string[];
  polarProductEnvKey: string | null;
};

export const GIGABYTE_BYTES = 1024 * 1024 * 1024;

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    slug: null,
    name: "Free",
    priceMonthly: null,
    limits: {
      activeStorageBytes: 10 * GIGABYTE_BYTES,
      maxTransferBytes: 2 * GIGABYTE_BYTES,
      retentionDays: 7,
    },
    marketingBullets: [
      "Up to 2 GB per transfer",
      "10 GB of active storage for live transfers",
      "Fast public links with 7-day expiry",
    ],
    polarProductEnvKey: null,
  },
  pro: {
    key: "pro",
    slug: "pro",
    name: "Pro",
    priceMonthly: 18,
    limits: {
      activeStorageBytes: 200 * GIGABYTE_BYTES,
      maxTransferBytes: 20 * GIGABYTE_BYTES,
      retentionDays: 7,
    },
    marketingBullets: [
      "Up to 20 GB per transfer",
      "200 GB of active storage for ongoing deliveries",
      "Priority support for client handoff work",
    ],
    polarProductEnvKey: "POLAR_PRODUCT_PRO_ID",
  },
};

export const PAID_PLAN_KEYS = ["pro"] as const satisfies readonly PaidPlanKey[];

export function getPlanDefinition(key: PlanKey) {
  return PLAN_CATALOG[key];
}

export function formatBytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let nextValue = value;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  return `${nextValue.toFixed(nextValue >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
