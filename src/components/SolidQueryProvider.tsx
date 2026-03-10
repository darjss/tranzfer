import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/solid-query";
import { type ParentProps } from "solid-js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60_000,
      refetchOnReconnect: false,
      retry: false,
      staleTime: 30_000,
    },
  },
});

export default function SolidQueryProvider(props: ParentProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  );
}
