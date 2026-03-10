import type { getAuth } from "@/server/lib/auth";

type Auth = ReturnType<typeof getAuth>;
type SessionResult = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

declare global {
  namespace App {
    interface Locals {
      session: SessionResult["session"] | null;
      user: SessionResult["user"] | null;
    }
  }
}

export {};
