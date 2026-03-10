import { queryOptions } from "@tanstack/solid-query";
import { authClient } from "@/lib/auth-client";
import { type PolarCustomerStateLike } from "@/lib/billing/polar";

const CUSTOMER_STATE_STALE_TIME_MS = 30_000;

export async function fetchCustomerState(): Promise<PolarCustomerStateLike | null> {
  const result = await authClient.customer.state();

  if (result.error) {
    throw new Error(result.error.message || "Could not load customer state.");
  }

  return result.data ?? null;
}

export function customerStateQueryOptions(
  cacheKey: string,
  enabled: boolean,
) {
  return queryOptions({
    enabled,
    queryFn: fetchCustomerState,
    queryKey: ["customer-state", cacheKey],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: CUSTOMER_STATE_STALE_TIME_MS,
  });
}
