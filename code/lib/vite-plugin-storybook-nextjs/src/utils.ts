import type { UserConfig } from "vite";

export const VITEST_PLUGIN_NAME = "vite-plugin-storybook-nextjs";

export const isVitestEnv = process.env.VITEST === "true";

export function getExecutionEnvironment(config: UserConfig) {
  return isVitestEnv && config.test?.browser?.enabled !== true
    ? "node"
    : "browser";
}
