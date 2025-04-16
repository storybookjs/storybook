import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { storybookNextJsPlugin } from "@storybook/nextjs-vite/vite-plugin";
import { defineConfig } from "vitest/config";

// More info at: https://storybook.js.org/docs/writing-tests/vitest-plugin
export default defineConfig({
  plugins: [
    // See options at: https://storybook.js.org/docs/writing-tests/vitest-plugin#storybooktest
    storybookTest({ configDir: ".storybook" }),
    storybookNextJsPlugin(),
  ],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      name: "chromium",
      provider: "playwright",
    },
    setupFiles: [".storybook/vitest.setup.ts"],
  },
});
