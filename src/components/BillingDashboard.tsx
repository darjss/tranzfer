import { useQuery } from "@tanstack/solid-query";
import { For, Show, Suspense, createMemo, createSignal } from "solid-js";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import SolidQueryProvider from "@/components/SolidQueryProvider";
import { authClient } from "@/lib/auth-client";
import {
  exceedsPlanLimits,
  getActivePlanInfo,
  getUpgradeMessage,
  isUpgradeAvailable,
  type BillingProductIds,
} from "@/lib/billing/polar";
import {
  PAID_PLAN_KEYS,
  getPlanDefinition,
  type PaidPlanKey,
} from "@/lib/billing/plans";
import { customerStateQueryOptions } from "@/lib/queries/billing";
import { cn } from "@/lib/utils";

type BillingDashboardProps = {
  productIds: BillingProductIds;
  userEmail: string;
  userName: string | null;
};

function BillingDashboardContent(props: BillingDashboardProps) {
  const [error, setError] = createSignal<string | null>(null);
  const [isManaging, setIsManaging] = createSignal(false);
  const [activeAction, setActiveAction] = createSignal<string | null>(null);
  const [workspaceUsage, setWorkspaceUsage] = createSignal(1);
  const [seatUsage, setSeatUsage] = createSignal(3);
  const customerStateQuery = useQuery(() =>
    customerStateQueryOptions("billing-dashboard", true),
  );

  const planInfo = createMemo(() =>
    getActivePlanInfo(customerStateQuery.data ?? null, props.productIds),
  );
  const currentPlan = createMemo(() => planInfo().currentPlan);
  const currentPlanDefinition = createMemo(() => getPlanDefinition(currentPlan()));
  const usage = createMemo(() => ({
    seats: seatUsage(),
    workspaces: workspaceUsage(),
  }));
  const usageControls = [
    {
      description: () => `${workspaceUsage()} active workspaces`,
      label: "Workspaces",
      max: 20,
      min: 0,
      setValue: setWorkspaceUsage,
      value: workspaceUsage,
    },
    {
      description: () => `${seatUsage()} active seats`,
      label: "Seats",
      max: 30,
      min: 0,
      setValue: setSeatUsage,
      value: seatUsage,
    },
  ] as const;
  const isOverLimit = createMemo(() =>
    exceedsPlanLimits(currentPlan(), usage()),
  );
  const upgradeMessage = createMemo(() =>
    getUpgradeMessage(currentPlan(), usage()),
  );
  const currentPeriodEnd = createMemo(() => {
    const periodEnd = planInfo().subscription?.currentPeriodEnd;

    if (!periodEnd) {
      return null;
    }

    return new Date(periodEnd).toLocaleDateString("en-US");
  });

  async function handleCheckout(plan: PaidPlanKey) {
    setError(null);
    setActiveAction(plan);

    try {
      const result = await authClient.checkout({
        slug: plan,
      });

      if (result.error) {
        throw new Error(result.error.message || "Could not start checkout.");
      }

      const url = result.data?.url;

      if (!url) {
        throw new Error("Polar checkout did not return a redirect URL.");
      }

      window.location.assign(url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start checkout.",
      );
      setActiveAction(null);
    }
  }

  async function handlePortal() {
    setError(null);
    setIsManaging(true);

    try {
      const result = await authClient.customer.portal();

      if (result.error) {
        throw new Error(result.error.message || "Could not open billing portal.");
      }

      const url = result.data?.url;

      if (!url) {
        throw new Error("Polar portal did not return a redirect URL.");
      }

      window.location.assign(url);
    } catch (portalError) {
      setError(
        portalError instanceof Error
          ? portalError.message
          : "Could not open billing portal.",
      );
      setIsManaging(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    window.location.assign("/");
  }

  return (
    <div class="grid gap-6">
      <Suspense
        fallback={
          <div class="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
            Loading customer state...
          </div>
        }
      >
        <section class="rounded-[2rem] border border-zinc-200 bg-white/92 p-6 shadow-[0_28px_75px_-42px_rgba(24,24,27,0.22)] sm:p-8">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                Billing
              </div>
              <h1 class="mt-4 text-3xl font-semibold tracking-[-0.05em] text-zinc-950 sm:text-4xl">
                {props.userName ? `${props.userName}'s billing` : "Billing overview"}
              </h1>
              <p class="mt-3 text-base leading-relaxed text-zinc-600">
                Signed in as {props.userEmail}. Polar is the source of truth for plan state.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <Button
                class="rounded-2xl"
                disabled={isManaging()}
                onClick={() => void handlePortal()}
                variant="outline"
              >
                {isManaging() ? "Opening portal..." : "Manage billing"}
              </Button>
              <Button class="rounded-2xl" onClick={() => void handleSignOut()} variant="ghost">
                Sign out
              </Button>
            </div>
          </div>

          <div class="mt-8 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
            <div class="rounded-[1.6rem] border border-zinc-200 bg-[#f6f1e7] p-5">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-medium text-zinc-500">Current plan</div>
                  <div class="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                    {currentPlanDefinition().name}
                  </div>
                </div>
                <Badge variant={planInfo().hasActiveSubscription ? "secondary" : "outline"}>
                  {planInfo().subscription?.status ?? "none"}
                </Badge>
              </div>

              <div class="mt-5 grid gap-3 text-sm text-zinc-700">
                <div class="flex items-center justify-between">
                  <span>Price</span>
                  <span>
                    {currentPlanDefinition().priceMonthly === null
                      ? "No active subscription"
                      : `$${currentPlanDefinition().priceMonthly}/month`}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Workspace limit</span>
                  <span>
                    {currentPlanDefinition().limits.workspaces ?? "Not available"}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Seat limit</span>
                  <span>{currentPlanDefinition().limits.seats ?? "Not available"}</span>
                </div>
                <Show when={currentPeriodEnd()}>
                  <div class="flex items-center justify-between">
                    <span>Current period ends</span>
                    <span>{currentPeriodEnd()}</span>
                  </div>
                </Show>
              </div>
            </div>

            <div class="rounded-[1.6rem] border border-zinc-200 bg-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-medium text-zinc-900">Soft-gate example</div>
                  <div class="text-sm text-zinc-500">
                    Tune mock usage to see upgrade guidance change.
                  </div>
                </div>
                <Badge variant={isOverLimit() ? "outline" : "secondary"}>
                  {isOverLimit() ? "Over limit" : "Within plan"}
                </Badge>
              </div>

              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                <For each={usageControls}>
                  {(control) => (
                    <label class="grid gap-2">
                      <span class="text-sm font-medium text-zinc-800">{control.label}</span>
                      <input
                        class="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950"
                        max={control.max}
                        min={control.min}
                        onInput={(event) => control.setValue(Number(event.currentTarget.value))}
                        type="range"
                        value={control.value()}
                      />
                      <span class="text-sm text-zinc-600">{control.description()}</span>
                    </label>
                  )}
                </For>
              </div>

              <div
                class={cn(
                  "mt-5 rounded-[1.3rem] border px-4 py-4 text-sm",
                  isOverLimit()
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700",
                )}
              >
                {upgradeMessage()}
              </div>
            </div>
          </div>
        </section>

        <section class="grid gap-5 lg:grid-cols-2">
          <For each={PAID_PLAN_KEYS}>
            {(planKey) => {
              const plan = getPlanDefinition(planKey);
              const disabled = () =>
                currentPlan() === planKey || activeAction() === planKey;

              return (
                <div
                  class={cn(
                    "rounded-[1.75rem] border p-6 shadow-[0_22px_55px_-40px_rgba(24,24,27,0.22)]",
                    planKey === "pro"
                      ? "border-zinc-900 bg-zinc-950 text-zinc-50"
                      : "border-zinc-200 bg-white text-zinc-950",
                  )}
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div
                        class={cn(
                          "text-[0.7rem] font-semibold uppercase tracking-[0.26em]",
                          planKey === "pro" ? "text-zinc-400" : "text-zinc-500",
                        )}
                      >
                        {plan.name}
                      </div>
                      <div class="mt-4 text-4xl font-semibold tracking-tight">
                        ${plan.priceMonthly}
                        <span
                          class={cn(
                            "ml-2 text-sm font-medium",
                            planKey === "pro" ? "text-zinc-300" : "text-zinc-500",
                          )}
                        >
                          / month
                        </span>
                      </div>
                    </div>
                    <Badge variant={currentPlan() === planKey ? "secondary" : "outline"}>
                      {currentPlan() === planKey ? "Current" : "Available"}
                    </Badge>
                  </div>

                  <div class="mt-5 space-y-3">
                    <For each={plan.marketingBullets}>
                      {(bullet) => (
                        <div
                          class={cn(
                            "flex items-center gap-3 text-sm",
                            planKey === "pro" ? "text-zinc-200" : "text-zinc-700",
                          )}
                        >
                          <span
                            class={cn(
                              "h-2 w-2 rounded-full",
                              planKey === "pro" ? "bg-amber-300" : "bg-amber-600",
                            )}
                          />
                          <span>{bullet}</span>
                        </div>
                      )}
                    </For>
                  </div>

                  <div class="mt-6 flex flex-wrap gap-3">
                    <Button
                      class="rounded-2xl"
                      disabled={disabled()}
                      onClick={() => void handleCheckout(planKey)}
                    >
                      {activeAction() === planKey
                        ? "Opening checkout..."
                        : currentPlan() === planKey
                          ? "Current plan"
                          : isUpgradeAvailable(currentPlan(), planKey)
                            ? `Upgrade to ${plan.name}`
                            : `Choose ${plan.name}`}
                    </Button>
                    <Show when={currentPlan() === "starter" && planKey === "pro"}>
                      <span class="self-center text-sm text-zinc-500">
                        Upgrade to raise seat and workspace limits.
                      </span>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </section>
      </Suspense>

      <Show when={customerStateQuery.isError || error()}>
        <div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error() || customerStateQuery.error?.message || "Billing data could not be loaded."}
          <button
            class={cn(buttonVariants({ size: "sm", variant: "outline" }), "ml-3 rounded-xl")}
            onClick={() => void customerStateQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      </Show>
    </div>
  );
}

export default function BillingDashboard(props: BillingDashboardProps) {
  return (
    <SolidQueryProvider>
      <BillingDashboardContent {...props} />
    </SolidQueryProvider>
  );
}
