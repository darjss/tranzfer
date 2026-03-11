import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type PolarCustomerStateLike, resolvePlanFromCustomerState } from "@/lib/billing/polar";
import { PLAN_CATALOG, type PlanKey } from "@/lib/billing/plans";
import { getBillingProductIds } from "@/server/lib/billing-config";
import { getDb } from "@/server/db";
import { userEntitlement } from "@/server/db/schema";

type EntitlementSource = "default" | "polar";

export async function ensureUserEntitlement(userId: string) {
  const db = getDb();
  const existing = await db.query.userEntitlement.findFirst({
    where: eq(userEntitlement.userId, userId),
  });

  if (existing) {
    return existing;
  }

  const created = {
    id: createId(),
    plan: "free" as const,
    source: "default" as const,
    userId,
  };

  await db.insert(userEntitlement).values(created);

  return db.query.userEntitlement.findFirst({
    where: eq(userEntitlement.userId, userId),
  });
}

export async function setUserEntitlement(input: {
  plan: PlanKey;
  polarCustomerId?: string | null;
  polarProductId?: string | null;
  source: EntitlementSource;
  userId: string;
}) {
  const db = getDb();

  await db
    .insert(userEntitlement)
    .values({
      id: createId(),
      plan: input.plan,
      polarCustomerId: input.polarCustomerId ?? null,
      polarProductId: input.polarProductId ?? null,
      source: input.source,
      userId: input.userId,
    })
    .onConflictDoUpdate({
      set: {
        plan: input.plan,
        polarCustomerId: input.polarCustomerId ?? null,
        polarProductId: input.polarProductId ?? null,
        source: input.source,
        updatedAt: new Date(),
      },
      target: userEntitlement.userId,
    });

  return db.query.userEntitlement.findFirst({
    where: eq(userEntitlement.userId, input.userId),
  });
}

export async function syncEntitlementFromCustomerState(
  customerState: PolarCustomerStateLike | null | undefined,
) {
  const userId = customerState?.externalId;

  if (!userId) {
    return null;
  }

  const productIds = getBillingProductIds();
  const plan = resolvePlanFromCustomerState(customerState, productIds);
  const activeSubscription =
    customerState?.activeSubscriptions?.find((subscription) => {
      return subscription.productId === productIds.pro;
    }) ?? null;

  return setUserEntitlement({
    plan,
    polarCustomerId: customerState?.id ?? null,
    polarProductId: activeSubscription?.productId ?? null,
    source: plan === "free" ? "default" : "polar",
    userId,
  });
}

export async function getUserPlan(userId: string) {
  const entitlement = await ensureUserEntitlement(userId);
  const plan: PlanKey = entitlement?.plan === "pro" ? "pro" : "free";

  return {
    definition: PLAN_CATALOG[plan],
    entitlement,
    plan,
  };
}
