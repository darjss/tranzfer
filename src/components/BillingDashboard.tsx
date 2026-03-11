import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { getPlanDefinition, type PaidPlanKey, type PlanKey, formatBytes } from "@/lib/billing/plans";

type BillingDashboardProps = {
  autoCheckout: boolean;
  currentPlan: PlanKey;
  userEmail: string;
  userName: string | null;
};

export default function BillingDashboard(props: BillingDashboardProps) {
  const [error, setError] = createSignal<string | null>(null);
  const [isManaging, setIsManaging] = createSignal(false);
  const [isCheckouting, setIsCheckouting] = createSignal(false);
  const planDefinition = createMemo(() => getPlanDefinition(props.currentPlan));
  const upgradePlan = createMemo<PaidPlanKey | null>(() => {
    if (props.currentPlan === "pro") {
      return null;
    }
    return "pro";
  });

  async function handleCheckout(plan: PaidPlanKey) {
    setError(null);
    setIsCheckouting(true);
    try {
      const result = await authClient.checkout({ slug: plan });
      if (result.error) throw new Error(result.error.message || "Could not start checkout.");
      if (!result.data?.url) throw new Error("Polar checkout did not return a redirect URL.");
      window.location.assign(result.data.url);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start checkout.");
      setIsCheckouting(false);
    }
  }

  async function handlePortal() {
    setError(null);
    setIsManaging(true);
    try {
      const result = await authClient.customer.portal();
      if (result.error) throw new Error(result.error.message || "Could not open billing portal.");
      if (!result.data?.url) throw new Error("Polar portal did not return a redirect URL.");
      window.location.assign(result.data.url);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not open billing portal.");
      setIsManaging(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    window.location.assign("/");
  }

  onMount(() => {
    if (props.autoCheckout && upgradePlan()) {
      void handleCheckout(upgradePlan()!);
    }
  });

  return (
    <div class="grid gap-8 animate-fade-up">
      <div class="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <div class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-3 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-electric animate-pulse-soft"></span>
            Billing Center
          </div>
          <h1 class="text-4xl font-medium tracking-tight text-white">
            {props.userName ? props.userName : "Operator"}
          </h1>
          <p class="mt-2 text-sm font-mono text-zinc-500 tracking-tight">
            ID: <span class="text-zinc-300">{props.userEmail}</span>
          </p>
        </div>

        <div class="flex gap-3">
          <a
            class="rounded-full border border-white/10 bg-transparent px-5 py-2 text-[0.75rem] font-mono uppercase tracking-wider text-zinc-300 transition-all duration-300 hover:bg-white/5 hover:text-white"
            href="/account/transfers"
          >
            Transfers
          </a>
          <button
            class="rounded-full border border-transparent bg-white/5 px-5 py-2 text-[0.75rem] font-mono uppercase tracking-wider text-zinc-300 transition-all duration-300 hover:bg-white/10 hover:text-white"
            disabled={isManaging()}
            onClick={() => void handlePortal()}
          >
            {isManaging() ? "LOADING..." : "MANAGE PORTAL"}
          </button>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div class="glass-panel rounded-[2rem] p-8 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-3 mb-6">
              <div class="text-[0.65rem] font-mono uppercase tracking-widest text-zinc-500">Current Allocation</div>
              <div class="px-2 py-1 rounded border border-white/10 bg-white/5 text-[0.6rem] font-mono uppercase tracking-widest text-white">
                {props.currentPlan === "pro" ? "ACTIVE" : "DEFAULT"}
              </div>
            </div>
            
            <div class="text-5xl font-medium tracking-tighter text-white mb-8">
              {planDefinition().name}
            </div>

            <div class="space-y-4 font-mono text-sm border-t border-white/10 pt-6">
              <div class="flex items-center justify-between">
                <span class="text-zinc-500">MONTHLY_COST</span>
                <span class="text-white">{planDefinition().priceMonthly === null ? "FREE" : `$${planDefinition().priceMonthly}`}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-zinc-500">TRANSFER_CAP</span>
                <span class="text-white">{formatBytes(planDefinition().limits.maxTransferBytes)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-zinc-500">STORAGE_LIMIT</span>
                <span class="text-white">{formatBytes(planDefinition().limits.activeStorageBytes)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-zinc-500">RETENTION</span>
                <span class="text-white">{planDefinition().limits.retentionDays} DAYS</span>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-panel rounded-[2rem] p-8 flex flex-col justify-between relative overflow-hidden">
          <div class="relative z-10">
            <div class="text-[0.65rem] font-mono uppercase tracking-widest text-zinc-500 mb-6">Included Features</div>
            <div class="grid gap-4">
              <For each={planDefinition().marketingBullets}>
                {(item) => (
                  <div class="flex items-center gap-4 text-[0.85rem] text-zinc-300 font-light">
                    <span class="h-1 w-1 rounded-full bg-electric shrink-0" />
                    <span>{item}</span>
                  </div>
                )}
              </For>
            </div>
          </div>

          <Show when={upgradePlan()}>
            <div class="mt-10 pt-8 border-t border-white/10 relative z-10">
              <div class="text-[0.65rem] font-mono uppercase tracking-widest text-electric mb-2">Upgrade Path Available</div>
              <h3 class="text-xl font-medium text-white mb-2">Unlock Pro Allocation</h3>
              <p class="text-sm text-zinc-400 mb-6">
                Expand your transfer capacity and overall storage volume instantly. No workflow changes.
              </p>
              <button
                class="w-full rounded-full bg-white px-6 py-4 text-[0.8rem] font-bold uppercase tracking-[0.15em] text-zinc-950 transition-all duration-500 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 hover:scale-[1.01] active:scale-95"
                disabled={isCheckouting()}
                onClick={() => void handleCheckout("pro")}
                type="button"
              >
                {isCheckouting() ? "ALLOCATING..." : "INITIATE UPGRADE"}
              </button>
            </div>
            <div class="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] bg-electric/10 rounded-full blur-[60px] pointer-events-none z-0"></div>
          </Show>
        </div>
      </div>

      <Show when={error()}>
        <div class="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-[0.8rem] font-mono text-red-400 text-center uppercase tracking-widest">
          ERR: {error()}
        </div>
      </Show>
    </div>
  );
}
