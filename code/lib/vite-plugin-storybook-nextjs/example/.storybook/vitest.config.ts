import path from "node:path";
import { storybookTest } from "@storybook/experimental-vitest-plugin";
import reactPlugin from "@vitejs/plugin-react";
import Inspect from "vite-plugin-inspect";
import vitePluginNext from "vite-plugin-storybook-nextjs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    vitePluginNext({ dir: path.join(__dirname, "..") }),
    storybookTest({
      renderer: "react",
    }),
    Inspect({ build: true, outputDir: ".vite-inspect" }),
    // for experimentation sake
    // reactPlugin(),
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

    // env: {
    //     // Necessary to avoid "act(...) is not supported in production builds of React"
    //     // for some reason Testing-library is resolving the production build of React in the tests
    //     NODE_ENV: "test",
    //   },
  },
});
