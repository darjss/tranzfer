import { useQuery } from "@tanstack/solid-query";
import { For, Show, Suspense, createMemo, createSignal } from "solid-js";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import SolidQueryProvider from "@/components/SolidQueryProvider";
import { authClient } from "@/lib/auth-client";
import {
  getActivePlanInfo,
  isUpgradeAvailable,
  type BillingProductIds,
} from "@/lib/billing/polar";
import {
  PAID_PLAN_KEYS,
  PLAN_CATALOG,
  type PaidPlanKey,
  type PlanKey,
} from "@/lib/billing/plans";
import { customerStateQueryOptions } from "@/lib/queries/billing";
import { cn } from "@/lib/utils";

type PricingSectionProps = {
  description: string;
  productIds: BillingProductIds;
  title: string;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatPrice(amount: number | null) {
  if (amount === null) return "Custom";
  return currencyFormatter.format(amount);
}

function PricingSectionContent(props: PricingSectionProps) {
  const session = authClient.useSession();
  const [checkoutingPlan, setCheckoutingPlan] = createSignal<PaidPlanKey | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const signedInUserId = createMemo(() => session().data?.user.id ?? null);
  const isSignedIn = createMemo(() => Boolean(signedInUserId()));
  const customerStateQuery = useQuery(() =>
    customerStateQueryOptions(
      `pricing:${signedInUserId() ?? "guest"}`,
      Boolean(signedInUserId()),
    ),
  );

  const currentPlan = createMemo<PlanKey>(() => {
    if (!isSignedIn()) {
      return "none";
    }

    return getActivePlanInfo(customerStateQuery.data ?? null, props.productIds).currentPlan;
  });

  async function startCheckout(plan: PaidPlanKey) {
    setCheckoutingPlan(plan);
    setError(null);

    try {
      const result = await authClient.checkout({
        slug: plan,
      });

      if (result.error) {
        throw new Error(result.error.message || "Could not start checkout.");
      }

      const checkoutUrl = result.data?.url;

      if (!checkoutUrl) {
        throw new Error("Polar checkout did not return a URL.");
      }

      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start checkout.",
      );
      setCheckoutingPlan(null);
    }
  }

  return (
    <section class="rounded-[2rem] border border-zinc-200 bg-white/92 p-6 shadow-[0_30px_80px_-38px_rgba(24,24,27,0.22)] sm:p-8">
      <div class="max-w-2xl">
        <div class="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
          Plans
        </div>
        <h2 class="mt-4 text-3xl font-semibold tracking-[-0.05em] text-zinc-950 sm:text-4xl">
          {props.title}
        </h2>
        <p class="mt-4 max-w-[42rem] text-base leading-relaxed text-zinc-600">
          {props.description}
        </p>
      </div>

      <Suspense
        fallback={
          <div class="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            Loading plan state...
          </div>
        }
      >
        <div class="mt-8 grid gap-5 lg:grid-cols-2">
          <For each={PAID_PLAN_KEYS}>
            {(planKey) => {
              const plan = PLAN_CATALOG[planKey];
              const isCurrent = () => currentPlan() === planKey;
              const canUpgrade = () => isUpgradeAvailable(currentPlan(), planKey);
              const buttonLabel = () => {
                if (!isSignedIn()) return `Choose ${plan.name}`;
                if (isCurrent()) return "Current plan";
                if (canUpgrade()) return `Upgrade to ${plan.name}`;
                return `Start ${plan.name}`;
              };

              return (
                <div
                  class={cn(
                    "flex h-full flex-col rounded-[1.75rem] border p-6 shadow-[0_22px_55px_-40px_rgba(24,24,27,0.22)]",
                    planKey === "pro"
                      ? "border-zinc-900 bg-zinc-950 text-zinc-50"
                      : "border-zinc-200 bg-[#f6f1e7] text-zinc-950",
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
                        {formatPrice(plan.priceMonthly)}
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

                    <Badge variant={isCurrent() ? "secondary" : "outline"}>
                      {isCurrent() ? "Current" : planKey === "pro" ? "Upgrade" : "Start"}
                    </Badge>
                  </div>

                  <div
                    class={cn(
                      "mt-5 rounded-[1.25rem] border px-4 py-4",
                      planKey === "pro"
                        ? "border-zinc-800 bg-zinc-900/80"
                        : "border-zinc-200 bg-white/85",
                    )}
                  >
                    <div
                      class={cn(
                        "text-sm font-medium",
                        planKey === "pro" ? "text-zinc-100" : "text-zinc-900",
                      )}
                    >
                      {plan.limits.workspaces} workspace
                      {plan.limits.workspaces === 1 ? "" : "s"} and {plan.limits.seats} seats
                    </div>
                    <div
                      class={cn(
                        "mt-1 text-sm",
                        planKey === "pro" ? "text-zinc-300" : "text-zinc-600",
                      )}
                    >
                      Monthly recurring subscription through Polar checkout.
                    </div>
                  </div>

                  <div class="mt-5 space-y-3">
                    <For each={plan.marketingBullets}>
                      {(item) => (
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
                          <span>{item}</span>
                        </div>
                      )}
                    </For>
                  </div>

                  <div class="mt-6">
                    <Show
                      fallback={
                        <a
                          class={cn(buttonVariants({ size: "default", variant: "default" }), "w-full rounded-2xl")}
                          href={`/auth/sign-up?plan=${planKey}`}
                        >
                          {buttonLabel()}
                        </a>
                      }
                      when={isSignedIn()}
                    >
                      <Button
                        class="w-full rounded-2xl"
                        disabled={isCurrent() || checkoutingPlan() === planKey}
                        onClick={() => void startCheckout(planKey)}
                      >
                        {checkoutingPlan() === planKey ? "Opening checkout..." : buttonLabel()}
                      </Button>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>

        <Show when={customerStateQuery.isError}>
          <div class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Billing state could not be loaded yet. Checkout is still available after sign-in.
          </div>
        </Show>
      </Suspense>

      <Show when={error()}>
        <div class="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error()}
        </div>
      </Show>
    </section>
  );
}

export default function PricingSection(props: PricingSectionProps) {
  return (
    <SolidQueryProvider>
      <PricingSectionContent {...props} />
    </SolidQueryProvider>
  );
}
