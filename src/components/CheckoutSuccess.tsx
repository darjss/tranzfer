import { createSignal } from "solid-js";
import { authClient } from "@/lib/auth-client";

type CheckoutSuccessProps = {
  checkoutId: string | null;
};

export default function CheckoutSuccess(props: CheckoutSuccessProps) {
  const [error, setError] = createSignal<string | null>(null);
  const [isManaging, setIsManaging] = createSignal(false);

  async function openPortal() {
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

  return (
    <section class="glass-panel rounded-[2rem] p-10 relative overflow-hidden animate-fade-up">
      <div class="absolute top-[-20%] right-[-10%] w-64 h-64 bg-electric/15 rounded-full blur-[80px] pointer-events-none"></div>

      <div class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-electric mb-4">
        TRANSACTION_COMPLETE
      </div>
      <h1 class="text-4xl font-medium tracking-tight text-white mb-4">
        Pro Allocation Synchronizing
      </h1>
      <p class="text-sm leading-relaxed text-zinc-400 max-w-2xl font-light mb-8">
        Reference ID: <span class="font-mono text-zinc-300">{props.checkoutId || "NULL"}</span>. 
        Your entitlement update has been queued in the webhook pipeline. The protocol will reflect your new limits shortly.
      </p>

      <div class="flex flex-wrap gap-4 relative z-10">
        <a
          class="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-[0.75rem] font-mono uppercase tracking-widest text-zinc-300 transition-all duration-300 hover:bg-white/10 hover:text-white"
          href="/account/billing"
        >
          VIEW BILLING
        </a>
        <a
          class="rounded-full bg-white px-6 py-3 text-[0.75rem] font-bold font-mono uppercase tracking-widest text-zinc-950 transition-all duration-300 hover:scale-[1.02] active:scale-95"
          href="/account/transfers"
        >
          RETURN TO TERMINAL
        </a>
        <button
          class="rounded-full border border-transparent px-6 py-3 text-[0.75rem] font-mono uppercase tracking-widest text-zinc-400 transition-all duration-300 hover:text-white"
          disabled={isManaging()}
          onClick={() => void openPortal()}
        >
          {isManaging() ? "LOADING PORTAL..." : "MANAGE SUBSCRIPTION"}
        </button>
      </div>

      {error() ? (
        <div class="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-[0.8rem] font-mono text-red-400 text-center uppercase tracking-widest">
          ERR: {error()}
        </div>
      ) : null}
    </section>
  );
}
