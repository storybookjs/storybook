import { createRequire } from "node:module";
import { resolve, sep } from "pathe";

import type { UserConfig } from "vite";

const require = createRequire(import.meta.url);

export const VITEST_PLUGIN_NAME = "vite-plugin-storybook-nextjs";

export const isVitestEnv = process.env.VITEST === "true";

export function getExecutionEnvironment(config: UserConfig) {
  return isVitestEnv && config.test?.browser?.enabled !== true
    ? "node"
    : "browser";
}

export const getNextjsVersion = (): string =>
  require("next/package.json").version;

export const getNextjsMajorVersion = (): number => {
  try {
    const version = getNextjsVersion();
    return Number.parseInt(version.split(".")[0], 10);
  } catch (error) {
    return 16;
  }
};
