import { createRequire } from "node:module";
import type { Plugin } from "vite";
import { VITEST_PLUGIN_NAME, isVitestEnv } from "../../utils";

const require = createRequire(import.meta.url);

type Env = "browser" | "node";

const getEntryPoint = (subPath: string, env: Env) =>
  require.resolve(`${VITEST_PLUGIN_NAME}/${env}/mocks/${subPath}`);

export const getAlias = (env: Env) => ({
  "next/headers": getEntryPoint("headers", env),
  "@storybook/nextjs/headers.mock": getEntryPoint("headers", env),
  "@storybook/nextjs-vite/headers.mock": getEntryPoint("headers", env),
  "next/navigation": getEntryPoint("navigation", env),
  "@storybook/nextjs/navigation.mock": getEntryPoint("navigation", env),
  "@storybook/nextjs-vite/navigation.mock": getEntryPoint("navigation", env),
  "next/router": getEntryPoint("router", env),
  "@storybook/nextjs/router.mock": getEntryPoint("router", env),
  "@storybook/nextjs-vite/router.mock": getEntryPoint("router", env),
  "next/cache": getEntryPoint("cache", env),
  "@storybook/nextjs/cache.mock": getEntryPoint("cache", env),
  "@storybook/nextjs-vite/cache.mock": getEntryPoint("cache", env),
  "server-only": getEntryPoint("server-only", env),
  "@opentelemetry/api": require.resolve(
    "next/dist/compiled/@opentelemetry/api",
  ),
});

export const vitePluginNextMocks = () =>
  ({
    name: "vite-plugin-next-mocks",
    config: (env) => {
      const aliasEnv =
        isVitestEnv && env.test?.browser?.enabled !== true ? "node" : "browser";
      return {
        resolve: {
          alias: getAlias(aliasEnv),
        },
      };
    },
  }) satisfies Plugin;
