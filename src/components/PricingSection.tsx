import { For, Show, createMemo, createSignal } from "solid-js";
import { authClient } from "@/lib/auth-client";
import { PLAN_CATALOG, PAID_PLAN_KEYS, formatBytes } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type PricingSectionProps = {
  description: string;
  title: string;
};

const PLAN_KEYS = ["free", ...PAID_PLAN_KEYS] as const;

export default function PricingSection(props: PricingSectionProps) {
  const session = authClient.useSession();
  const [isCheckouting, setIsCheckouting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const isSignedIn = createMemo(() => Boolean(session().data?.user.id));

  async function startCheckout() {
    setError(null);
    setIsCheckouting(true);

    try {
      const result = await authClient.checkout({
        slug: "pro",
      });

      if (result.error) {
        throw new Error(result.error.message || "Could not start checkout.");
      }

      if (!result.data?.url) {
        throw new Error("Polar checkout did not return a redirect URL.");
      }

      window.location.assign(result.data.url);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start checkout.");
      setIsCheckouting(false);
    }
  }

  return (
    <section class="animate-fade-up">
      <div class="max-w-2xl mb-12">
        <div class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2 mb-4">
          <span class="w-1.5 h-1.5 rounded-full bg-electric animate-pulse"></span>
          Bandwidth Specs
        </div>
        <h2 class="text-4xl font-medium tracking-tight text-white mb-4">
          {props.title}
        </h2>
        <p class="max-w-[42rem] text-[0.95rem] leading-relaxed text-zinc-400 font-light">
          {props.description}
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-2 relative">
        <For each={PLAN_KEYS}>
          {(planKey) => {
            const plan = PLAN_CATALOG[planKey];

            return (
              <article
                class={cn(
                  "flex h-full flex-col p-8 transition-all duration-500 overflow-hidden relative",
                  planKey === "pro"
                    ? "liquid-glass rounded-[2rem] z-10 scale-[1.02] shadow-[0_0_80px_-20px_rgba(0,87,255,0.15)]"
                    : "glass-panel rounded-[2rem] hover:-translate-y-1 hover:bg-white/[0.02]"
                )}
              >
                {planKey === "pro" && (
                  <div class="absolute top-0 right-0 w-64 h-64 bg-electric/10 rounded-full blur-[60px] pointer-events-none"></div>
                )}
                
                <div class="flex items-start justify-between gap-3 relative z-10">
                  <div>
                    <div
                      class={cn(
                        "font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em]",
                        planKey === "pro" ? "text-electric" : "text-zinc-500"
                      )}
                    >
                      {plan.name} // SPEC
                    </div>
                    <div class="mt-4 text-5xl font-medium tracking-tighter text-white">
                      {plan.priceMonthly === null ? "Free" : `$${plan.priceMonthly}`}
                      <span
                        class={cn(
                          "ml-2 text-[0.8rem] font-mono tracking-widest uppercase align-middle",
                          planKey === "pro" ? "text-electric/70" : "text-zinc-600"
                        )}
                      >
                        {plan.priceMonthly === null ? "PERPETUAL" : "/ MNTH"}
                      </span>
                    </div>
                  </div>

                  <div class={cn(
                    "px-3 py-1 rounded-full text-[0.6rem] font-mono uppercase tracking-widest border",
                    planKey === "pro" ? "border-electric/30 bg-electric/10 text-electric" : "border-white/10 bg-white/5 text-zinc-400"
                  )}>
                    {planKey === "pro" ? "Upgrade" : "Default"}
                  </div>
                </div>

                <div
                  class={cn(
                    "mt-8 px-5 py-4 border-l-2",
                    planKey === "pro"
                      ? "border-electric bg-white/[0.02]"
                      : "border-zinc-700 bg-white/[0.01]"
                  )}
                >
                  <div class="text-sm font-medium text-white mb-1.5">
                    {formatBytes(plan.limits.maxTransferBytes)} PER TRANSFER
                  </div>
                  <div class="text-[0.8rem] text-zinc-400 leading-relaxed font-light">
                    {formatBytes(plan.limits.activeStorageBytes)} of active storage, public links,
                    and {plan.limits.retentionDays}-day expiry.
                  </div>
                </div>

                <div class="mt-8 space-y-4 flex-1 relative z-10">
                  <For each={plan.marketingBullets}>
                    {(item) => (
                      <div class="flex items-start gap-4 text-[0.85rem] text-zinc-400 font-light leading-relaxed">
                        <span class={cn("mt-1.5 h-1 w-1 rounded-full shrink-0", planKey === "pro" ? "bg-electric" : "bg-zinc-600")} />
                        <span>{item}</span>
                      </div>
                    )}
                  </For>
                </div>

                <div class="mt-10 pt-6 border-t border-white/5 relative z-10">
                  <Show
                    when={planKey === "pro"}
                    fallback={
                      <a
                        class="block w-full text-center rounded-full border border-white/10 bg-transparent py-4 text-[0.75rem] font-mono uppercase tracking-widest text-zinc-300 transition-all duration-300 hover:bg-white/5 hover:text-white"
                        href={isSignedIn() ? "/account/transfers" : "/auth/sign-up"}
                      >
                        {isSignedIn() ? "ENTER TERMINAL" : "ESTABLISH CREDENTIALS"}
                      </a>
                    }
                  >
                    <Show
                      when={isSignedIn()}
                      fallback={
                        <a
                          class="block w-full text-center rounded-full bg-white py-4 text-[0.75rem] font-bold font-mono uppercase tracking-[0.15em] text-zinc-950 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95"
                          href="/auth/sign-up?plan=pro"
                        >
                          INITIATE UPGRADE
                        </a>
                      }
                    >
                      <button
                        class="w-full rounded-full bg-white py-4 text-[0.75rem] font-bold font-mono uppercase tracking-[0.15em] text-zinc-950 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95 disabled:opacity-50"
                        disabled={isCheckouting()}
                        onClick={() => void startCheckout()}
                        type="button"
                      >
                        {isCheckouting() ? "ALLOCATING..." : "UPGRADE TO PRO"}
                      </button>
                    </Show>
                  </Show>
                </div>
              </article>
            );
          }}
        </For>
      </div>

      <Show when={error()}>
        <div class="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-[0.8rem] font-mono text-red-400 text-center uppercase tracking-widest">
          ERR: {error()}
        </div>
      </Show>
    </section>
  );
}
