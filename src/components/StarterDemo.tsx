import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "annual";
type Stage = "idle" | "syncing" | "ready";

type Activity = {
  detail: string;
  label: string;
  time: string;
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);

const StarterDemo = () => {
  const [billing, setBilling] = createSignal<Billing>("annual");
  const [workspace, setWorkspace] = createSignal("North Pier");
  const [seats, setSeats] = createSignal(8);
  const [stage, setStage] = createSignal<Stage>("idle");
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [activities, setActivities] = createSignal<Activity[]>([]);

  let syncTimeout: ReturnType<typeof setTimeout> | undefined;

  const seatPrice = createMemo(() => (billing() === "annual" ? 24 : 29));
  const total = createMemo(() => seats() * seatPrice());
  const yearlySavings = createMemo(() => seats() * 5 * 12);

  const addActivity = (label: string, detail: string) => {
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());

    setActivities((current) => [{ detail, label, time }, ...current].slice(0, 4));
  };

  const runDemo = () => {
    if (isSyncing()) {
      return;
    }

    clearTimeout(syncTimeout);
    setIsSyncing(true);
    setStage("syncing");
    addActivity("Draft updated", `${workspace()} workspace recalculated for ${seats()} seats.`);

    syncTimeout = setTimeout(() => {
      setIsSyncing(false);
      setStage("ready");
      addActivity("Deploy preview", "Pricing and onboarding copy refreshed in the preview branch.");
    }, 1200);
  };

  const resetDemo = () => {
    clearTimeout(syncTimeout);
    setBilling("annual");
    setWorkspace("North Pier");
    setSeats(8);
    setStage("idle");
    setIsSyncing(false);
    setActivities([]);
  };

  onCleanup(() => clearTimeout(syncTimeout));

  return (
    <div class="rounded-[2rem] border border-zinc-200/80 bg-white/92 p-4 shadow-[0_30px_80px_-38px_rgba(24,24,27,0.28)] backdrop-blur-sm sm:p-6">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
            Live Demo
          </p>
          <h3 class="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
            Tune the starter without leaving the page
          </h3>
        </div>
        <Badge
          class="rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em]"
          variant={stage() === "ready" ? "secondary" : "outline"}
        >
          {stage() === "idle" ? "Draft" : stage() === "syncing" ? "Syncing" : "Ready"}
        </Badge>
      </div>

      <Separator class="my-5" />

      <div class="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <div class="space-y-5">
          <label class="grid gap-2">
            <span class="text-sm font-medium text-zinc-800">Workspace name</span>
            <Input
              class="rounded-2xl border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
              onInput={(event) => setWorkspace(event.currentTarget.value)}
              placeholder="North Pier"
              value={workspace()}
            />
            <span class="text-xs text-zinc-500">
              This feeds the starter’s pricing, copy, and preview labels.
            </span>
          </label>

          <div class="grid gap-2">
            <span class="text-sm font-medium text-zinc-800">Team seats</span>
            <div class="flex items-center gap-2 rounded-[1.4rem] border border-zinc-200 bg-zinc-50/90 p-2">
              <button
                class={cn(buttonVariants({ size: "icon-sm", variant: "outline" }), "rounded-xl")}
                disabled={seats() <= 1}
                onClick={() => setSeats((value) => Math.max(1, value - 1))}
                type="button"
              >
                -
              </button>
              <div class="flex-1 text-center">
                <div class="text-2xl font-semibold tracking-tight text-zinc-950">{seats()}</div>
                <div class="text-xs uppercase tracking-[0.18em] text-zinc-500">active seats</div>
              </div>
              <button
                class={cn(buttonVariants({ size: "icon-sm", variant: "outline" }), "rounded-xl")}
                onClick={() => setSeats((value) => Math.min(50, value + 1))}
                type="button"
              >
                +
              </button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button class="rounded-2xl px-4" onClick={runDemo}>
              {isSyncing() ? "Refreshing preview" : "Run pricing demo"}
            </Button>
            <Button class="rounded-2xl px-4" onClick={resetDemo} variant="outline">
              Reset
            </Button>
          </div>
        </div>

        <div class="rounded-[1.6rem] border border-zinc-200 bg-zinc-50/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <Tabs class="gap-4" onChange={(value) => setBilling(value as Billing)} value={billing()}>
            <div class="flex items-center justify-between gap-3">
              <TabsList class="rounded-2xl border border-zinc-200 bg-white p-1" variant="line">
                <TabsTrigger class="rounded-xl px-3 py-2 text-sm" value="monthly">
                  Monthly
                </TabsTrigger>
                <TabsTrigger class="rounded-xl px-3 py-2 text-sm" value="annual">
                  Annual
                </TabsTrigger>
              </TabsList>
              <Badge class="rounded-full px-3 py-1 text-xs" variant="outline">
                {billing() === "annual" ? `${formatMoney(yearlySavings())}/yr less` : "Flexible"}
              </Badge>
            </div>

            <TabsContent class="space-y-4 pt-4" value="monthly">
              <div class="rounded-[1.4rem] bg-white p-4">
                <div class="text-sm text-zinc-500">Monthly run rate</div>
                <div class="mt-2 text-4xl font-semibold tracking-tight text-zinc-950">
                  {formatMoney(total())}
                </div>
                <div class="mt-1 text-sm text-zinc-500">
                  {formatMoney(seatPrice())} per seat for {workspace()}.
                </div>
              </div>
            </TabsContent>

            <TabsContent class="space-y-4 pt-4" value="annual">
              <div class="rounded-[1.4rem] bg-white p-4">
                <div class="text-sm text-zinc-500">Annualized plan</div>
                <div class="mt-2 text-4xl font-semibold tracking-tight text-zinc-950">
                  {formatMoney(total())}
                </div>
                <div class="mt-1 text-sm text-zinc-500">
                  Billed monthly, priced for a 12-month rollout.
                </div>
              </div>
            </TabsContent>

            <div class="grid gap-3 rounded-[1.4rem] border border-zinc-200 bg-white p-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-zinc-900">Recent activity</div>
                  <div class="text-xs text-zinc-500">
                    A simple signal-driven log using the installed Zaidan components.
                  </div>
                </div>
                <div class="text-xs uppercase tracking-[0.18em] text-zinc-400">Solid</div>
              </div>

              <Show
                fallback={
                  <div class="rounded-[1.2rem] border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">
                    Run the demo to see a pricing update and preview event appear here.
                  </div>
                }
                when={activities().length > 0}
              >
                <div class="space-y-2">
                  <For each={activities()}>
                    {(activity) => (
                      <div class="rounded-[1.1rem] border border-zinc-200 px-3 py-3">
                        <div class="flex items-center justify-between gap-3">
                          <div class="text-sm font-medium text-zinc-900">{activity.label}</div>
                          <div class="text-xs uppercase tracking-[0.18em] text-zinc-400">
                            {activity.time}
                          </div>
                        </div>
                        <div class="mt-1 text-sm text-zinc-500">{activity.detail}</div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={isSyncing()}>
                <div class="grid gap-2 pt-1">
                  <div class="h-2 rounded-full bg-zinc-200/80">
                    <div class="h-2 w-1/2 animate-pulse rounded-full bg-zinc-400/70" />
                  </div>
                  <div class="h-2 rounded-full bg-zinc-200/80">
                    <div class="h-2 w-2/3 animate-pulse rounded-full bg-zinc-300/80" />
                  </div>
                </div>
              </Show>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default StarterDemo;
