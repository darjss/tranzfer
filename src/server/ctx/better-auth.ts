import { Elysia } from "elysia";
import { getAuth } from "@/server/lib/auth";

export const betterAuthPlugin = new Elysia({ name: "@[better-auth]" }).macro({
  auth: {
    async resolve({ status, request: { headers } }) {
      const session = await getAuth().api.getSession({
        headers,
      });

      if (!session) return status(401, "Unauthorized");

      return {
        user: session.user,
        session: session.session,
      };
    },
  },
});
