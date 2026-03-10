import { polarClient } from "@polar-sh/better-auth/client";
import { createAuthClient } from "better-auth/solid";

export const authClient = createAuthClient({
  plugins: [polarClient()],
});
