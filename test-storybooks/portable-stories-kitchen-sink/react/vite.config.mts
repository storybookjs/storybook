import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    storybookTest(
      process.env.SKIP_FAIL_ON_PURPOSE
        ? {
            tags: {
              exclude: ["fail-on-purpose"],
            },
          }
        : undefined
    ),
  ],
  test: {
    name: "storybook",
    pool: "threads",
    deps: {
      optimizer: {
        web: {
          enabled: false,
        },
      },
    },
    browser: {
      enabled: true,
      provider: playwright({}),
      headless: true,
      instances: [
        {
          browser: "chromium",
        },
      ],
    },
    setupFiles: ["./.storybook/vitest.setup.ts"],
    environment: "jsdom",
  },
});
