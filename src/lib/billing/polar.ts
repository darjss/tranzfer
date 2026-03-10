import { PLAN_CATALOG, type PlanKey } from "@/lib/billing/plans";

export type BillingProductIds = {
  pro: string;
  starter: string;
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
  grantedBenefits?: unknown[];
};

export type ResolvedPlanInfo = {
  currentPlan: PlanKey;
  hasActiveSubscription: boolean;
  subscription: PolarSubscriptionLike | null;
};

export type UsageSnapshot = {
  seats: number;
  workspaces: number;
};

function getPlanPriority(plan: PlanKey) {
  if (plan === "pro") return 2;
  if (plan === "starter") return 1;
  return 0;
}

export function resolvePlanFromCustomerState(
  customerState: PolarCustomerStateLike | null | undefined,
  productIds: BillingProductIds,
): PlanKey {
  const subscriptions = customerState?.activeSubscriptions ?? [];

  let resolvedPlan: PlanKey = "none";

  for (const subscription of subscriptions) {
    const productId = subscription.productId;

    if (!productId) continue;

    let candidate: PlanKey = "none";

    if (productId === productIds.starter) {
      candidate = "starter";
    }

    if (productId === productIds.pro) {
      candidate = "pro";
    }

    if (getPlanPriority(candidate) > getPlanPriority(resolvedPlan)) {
      resolvedPlan = candidate;
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

      if (currentPlan === "starter") {
        return item.productId === productIds.starter;
      }

      return false;
    }) ?? null;

  return {
    currentPlan,
    hasActiveSubscription: currentPlan !== "none",
    subscription,
  };
}

export function isUpgradeAvailable(currentPlan: PlanKey, targetPlan: PlanKey) {
  return getPlanPriority(targetPlan) > getPlanPriority(currentPlan);
}

export function exceedsPlanLimits(plan: PlanKey, usage: UsageSnapshot) {
  const definition = PLAN_CATALOG[plan];

  if (plan === "none") return usage.seats > 0 || usage.workspaces > 0;

  return (
    (definition.limits.seats !== null && usage.seats > definition.limits.seats) ||
    (definition.limits.workspaces !== null &&
      usage.workspaces > definition.limits.workspaces)
  );
}

export function getUpgradeMessage(plan: PlanKey, usage: UsageSnapshot) {
  if (plan === "none") {
    return "Pick a plan to start using workspaces and seats.";
  }

  const definition = PLAN_CATALOG[plan];

  if (!exceedsPlanLimits(plan, usage)) {
    return `${definition.name} covers your current usage.`;
  }

  if (plan === "starter") {
    return "Starter covers 1 workspace and 5 seats. Upgrade to Pro for more room.";
  }

  return "Pro covers 10 workspaces and 25 seats. Contact support for custom limits.";
}
