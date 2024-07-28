import Inspect from "vite-plugin-inspect";
import vitePluginNext from "vite-plugin-storybook-nextjs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    vitePluginNext(),
    Inspect({ build: true, outputDir: ".vite-inspect" }),
  ],
  test: {
    name: "next",
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
