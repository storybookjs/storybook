import { defineWorkspace } from "vitest/config";
import { storybookTest } from "@storybook/experimental-addon-test/vitest-plugin";

export default defineWorkspace([
  {
    extends: "vite.config.ts",
    plugins: [
      storybookTest(process.env.SKIP_FAIL_ON_PURPOSE ? {
        tags: {
          exclude: ["fail-on-purpose"],
        }
      } : undefined),
    ],
    test: {
      name: "storybook",
      pool: "threads",
      deps: {
        optimizer: {
          web: { 
            enabled: false
          }
        }
      },
      browser: {
        enabled: true,
        name: "chromium",
        provider: "playwright",
        headless: true,
      },
      setupFiles: ["./.storybook/vitest.setup.ts"],
      environment: "happy-dom",
    },
  },
]);
