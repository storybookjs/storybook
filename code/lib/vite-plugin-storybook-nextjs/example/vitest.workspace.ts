import { storybookTest } from "@storybook/experimental-vitest-plugin";
import reactPlugin from "@vitejs/plugin-react";
import Inspect from "vite-plugin-inspect";
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "./vitest.config.ts",
  {
    extends: "./vitest.config.ts",
    plugins: [
      storybookTest({
        renderer: "react",
      }),
      Inspect({ build: true, outputDir: ".vite-inspect" }),
      // for experimentation sake
      // reactPlugin(),
    ],
    test: {
      name: "storybook",
      include: ["src/**/*.{story,stories}.?(c|m)[jt]s?(x)"],
      browser: {
        enabled: true,
        name: "chromium",
        provider: "playwright",
        headless: true,
      },
      setupFiles: ["./storybook.setup.ts"],
    },
  },
]);
