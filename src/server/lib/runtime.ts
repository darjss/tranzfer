import { AsyncLocalStorage } from "node:async_hooks";
import type { Runtime } from "@astrojs/cloudflare";
import type { CloudflareEnv } from "../../../types/env";

type CloudflareRuntime = Runtime<CloudflareEnv>["runtime"];

const runtimeStorage = new AsyncLocalStorage<CloudflareRuntime>();

export function runWithRuntime<T>(
  runtime: CloudflareRuntime,
  callback: () => T,
) {
  return runtimeStorage.run(runtime, callback);
}

export function getRuntime() {
  const runtime = runtimeStorage.getStore();

  if (!runtime) {
    throw new Error("Cloudflare runtime is not available for this request.");
  }

  return runtime;
}

export function getRuntimeEnv() {
  return getRuntime().env;
}
