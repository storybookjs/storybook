import { storybookNextJsPlugin } from "@storybook/experimental-nextjs-vite/vite-plugin";
import Inspect from "vite-plugin-inspect";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    Inspect({ build: true, outputDir: ".vite-inspect" }),
    storybookNextJsPlugin(),
  ],
  test: {
    name: "next",
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
