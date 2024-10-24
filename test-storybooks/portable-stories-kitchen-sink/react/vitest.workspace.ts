import { defineWorkspace } from "vitest/config";
import { storybookTest } from "@storybook/experimental-addon-test/vitest-plugin";

export default defineWorkspace([
  {
    extends: "vite.config.ts",
    plugins: [
      storybookTest(),
    ],
    test: {
      name: "storybook",
      pool: "threads",
      include: [
        "stories/AddonTest.stories.?(c|m)[jt]s?(x)",
      ],
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