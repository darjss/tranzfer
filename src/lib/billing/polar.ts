import { PLAN_CATALOG, type PlanKey } from "@/lib/billing/plans";

export type BillingProductIds = {
  pro: string;
};

export type PolarSubscriptionLike = {
  amount?: number;
  currency?: string;
  currentPeriodEnd?: Date | string;
  productId?: string | null;
  recurringInterval?: string;
  status?: string;
};

export type PolarCustomerStateLike = {
  activeSubscriptions?: PolarSubscriptionLike[];
  externalId?: string | null;
  grantedBenefits?: unknown[];
  id?: string;
};

export type ResolvedPlanInfo = {
  currentPlan: PlanKey;
  hasActiveSubscription: boolean;
  subscription: PolarSubscriptionLike | null;
};

export type UsageSnapshot = {
  activeStorageBytes: number;
  maxTransferBytes: number;
};

function getPlanPriority(plan: PlanKey) {
  if (plan === "pro") return 1;
  return 0;
}

export function resolvePlanFromCustomerState(
  customerState: PolarCustomerStateLike | null | undefined,
  productIds: BillingProductIds,
): PlanKey {
  const subscriptions = customerState?.activeSubscriptions ?? [];

  let resolvedPlan: PlanKey = "free";

  for (const subscription of subscriptions) {
    if (subscription.productId === productIds.pro) {
      resolvedPlan = "pro";
    }
  }

  return resolvedPlan;
}

export function getActivePlanInfo(
  customerState: PolarCustomerStateLike | null | undefined,
  productIds: BillingProductIds,
): ResolvedPlanInfo {
  const currentPlan = resolvePlanFromCustomerState(customerState, productIds);
  const subscription =
    customerState?.activeSubscriptions?.find((item) => {
      if (currentPlan === "pro") {
        return item.productId === productIds.pro;
      }

      return false;
    }) ?? null;

  return {
    currentPlan,
    hasActiveSubscription: currentPlan !== "free",
    subscription,
  };
}

export function isUpgradeAvailable(currentPlan: PlanKey, targetPlan: PlanKey) {
  return getPlanPriority(targetPlan) > getPlanPriority(currentPlan);
}

export function exceedsPlanLimits(plan: PlanKey, usage: UsageSnapshot) {
  const definition = PLAN_CATALOG[plan];

  return (
    usage.activeStorageBytes > definition.limits.activeStorageBytes ||
    usage.maxTransferBytes > definition.limits.maxTransferBytes
  );
}

export function getUpgradeMessage(plan: PlanKey, usage: UsageSnapshot) {
  const definition = PLAN_CATALOG[plan];

  if (!exceedsPlanLimits(plan, usage)) {
    return `${definition.name} covers your current usage.`;
  }

  if (plan === "free") {
    return "Free covers up to 2 GB per transfer and 10 GB of active storage. Upgrade to Pro for larger deliveries.";
  }

  return "Pro gives you more room for active transfers. Delete old transfers to free storage.";
}
