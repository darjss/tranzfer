import { Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import {
  getActivePlanInfo,
  type PolarCustomerStateLike,
  type BillingProductIds,
} from "@/lib/billing/polar";
import { getPlanDefinition } from "@/lib/billing/plans";

type CheckoutSuccessProps = {
  checkoutId: string | null;
  productIds: BillingProductIds;
};

type SyncState = "idle" | "syncing" | "synced" | "timeout" | "error";

const SYNC_POLL_INTERVAL_MS = 3_000;
const SYNC_TIMEOUT_MS = 60_000;

export default function CheckoutSuccess(props: CheckoutSuccessProps) {
  const [syncState, setSyncState] = createSignal<SyncState>("idle");
  const [error, setError] = createSignal<string | null>(null);
  const [customerState, setCustomerState] = createSignal<PolarCustomerStateLike | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const planInfo = createMemo(() =>
    getActivePlanInfo(customerState(), props.productIds),
  );
  const resolvedPlan = createMemo(() => getPlanDefinition(planInfo().currentPlan));

  async function openPortal() {
    const result = await authClient.customer.portal();

    if (result.error) {
      setError(result.error.message || "Could not open billing portal.");
      return;
    }

    if (result.data?.url) {
      window.location.assign(result.data.url);
    }
  }

  async function syncCustomerState() {
    setSyncState("syncing");
    setError(null);
    if (timer) clearTimeout(timer);

    const startedAt = Date.now();

    const runAttempt = async () => {
      try {
        const result = await authClient.customer.state();

        if (result.error) {
          throw new Error(result.error.message || "Could not load customer state.");
        }

        const nextState = result.data ?? null;
        setCustomerState(nextState);

        const nextPlan = getActivePlanInfo(nextState, props.productIds).currentPlan;

        if (nextPlan !== "none") {
          setSyncState("synced");
          return;
        }

        if (Date.now() - startedAt >= SYNC_TIMEOUT_MS) {
          setSyncState("timeout");
          return;
        }

        timer = setTimeout(() => {
          void runAttempt();
        }, SYNC_POLL_INTERVAL_MS);
      } catch (syncError) {
        setError(
          syncError instanceof Error
            ? syncError.message
            : "Could not sync checkout state.",
        );
        setSyncState("error");
      }
    };

    await runAttempt();
  }

  onMount(() => {
    void syncCustomerState();
  });

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  return (
    <section class="rounded-[2rem] border border-zinc-200 bg-white/92 p-6 shadow-[0_28px_75px_-42px_rgba(24,24,27,0.22)] sm:p-8">
      <div class="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
        Checkout success
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <h1 class="text-3xl font-semibold tracking-[-0.05em] text-zinc-950 sm:text-4xl">
          Payment received. Syncing your billing state.
        </h1>
        <Badge variant={syncState() === "synced" ? "secondary" : "outline"}>
          {syncState()}
        </Badge>
      </div>

      <p class="mt-4 max-w-[42rem] text-base leading-relaxed text-zinc-600">
        Checkout ID: {props.checkoutId || "not provided"}. Polar state will be refreshed until
        an active plan is visible or the sync window expires.
      </p>

      <Show when={syncState() === "synced"}>
        <div class="mt-6 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          Your plan is now {resolvedPlan().name}. You can review billing and limits from the
          billing page.
        </div>
      </Show>

      <Show when={syncState() === "timeout"}>
        <div class="mt-6 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          Payment was submitted, but the customer state is still syncing. You can refresh this
          page or open the billing portal.
        </div>
      </Show>

      <Show when={syncState() === "error" && error()}>
        <div class="mt-6 rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {error()}
        </div>
      </Show>

      <div class="mt-8 flex flex-wrap gap-3">
        <a class="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900" href="/account/billing">
          Go to billing
        </a>
        <Button class="rounded-2xl" onClick={() => void syncCustomerState()} variant="outline">
          Refresh status
        </Button>
        <Button class="rounded-2xl" onClick={() => void openPortal()} variant="ghost">
          Manage billing
        </Button>
      </div>
    </section>
  );
}
