import path from "node:path";
import url from "node:url";
import { storybookTest } from "@storybook/experimental-addon-test/vitest-plugin";
import { storybookNextJsPlugin } from "@storybook/experimental-nextjs-vite/vite-plugin";
import Inspect from "vite-plugin-inspect";
import { defineConfig } from "vitest/config";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    storybookTest({
      configDir: __dirname,
    }),
    storybookNextJsPlugin({ dir: path.join(__dirname, "..") }),
    Inspect({ build: true, outputDir: ".vite-inspect" }),
  ],
  test: {
    name: "storybook",
    include: ["../src/**/*.{story,stories}.?(c|m)[jt]s?(x)"],
    browser: {
      enabled: true,
      name: "chromium",
      provider: "playwright",
      headless: true,
    },
    setupFiles: ["./storybook.setup.ts"],
    environment: "happy-dom",
  },
});
