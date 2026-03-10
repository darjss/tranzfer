import alchemy from "alchemy/cloudflare/astro";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

import solidJs from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: alchemy(),
  integrations: [solidJs()],

  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [tailwindcss()],
  },
});
