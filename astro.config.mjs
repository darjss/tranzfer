import { existsSync } from "node:fs";
import alchemy from "alchemy/cloudflare/astro";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

import solidJs from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";

const localAlchemyWranglerConfig = fileURLToPath(
  new URL("./.alchemy/local/wrangler.jsonc", import.meta.url),
);

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: alchemy({
    platformProxy: {
      configPath: existsSync(localAlchemyWranglerConfig)
        ? localAlchemyWranglerConfig
        : "./wrangler.jsonc",
    },
  }),
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
