import { resolve } from "node:path";

import { createRequire } from "node:module";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";
import type { Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { vitePluginNextEnv } from "./plugins/next-env/plugin";
import { vitePluginNextFont } from "./plugins/next-font/plugin";
import { vitePluginNextSwc } from "./plugins/next-swc/plugin";

import "./polyfills/promise-with-resolvers";
import nextServerConfig from "next/dist/server/config.js";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_TEST,
} from "next/dist/shared/lib/constants.js";
import { vitePluginNextDynamic } from "./plugins/next-dynamic/plugin";
import { vitePluginNextImage } from "./plugins/next-image/plugin";
import { vitePluginNextMocks } from "./plugins/next-mocks/plugin";
import { getExecutionEnvironment, isVitestEnv } from "./utils";

const require = createRequire(import.meta.url);
const loadConfig: typeof nextServerConfig =
  // biome-ignore lint/suspicious/noExplicitAny: CJS support
  (nextServerConfig as any).default || nextServerConfig;

type VitePluginOptions = {
  /**
   * Provide the path to your Next.js project directory
   * @default process.cwd()
   */
  dir?: string;
};

function VitePlugin({
  dir = process.cwd(),
}: VitePluginOptions = {}): (Plugin | Promise<Plugin>)[] {
  const resolvedDir = resolve(dir);
  const nextConfigResolver = Promise.withResolvers<NextConfigComplete>();

  return [
    tsconfigPaths({ root: resolvedDir }),
    {
      name: "vite-plugin-storybook-nextjs",
      enforce: "pre" as const,
      async config(config, env) {
        const phase =
          env.mode === "development"
            ? PHASE_DEVELOPMENT_SERVER
            : env.mode === "test"
              ? PHASE_TEST
              : PHASE_PRODUCTION_BUILD;

        nextConfigResolver.resolve(await loadConfig(phase, resolvedDir));

        const executionEnvironment = getExecutionEnvironment(config);

        return {
          ...(!isVitestEnv && {
            resolve: {
              alias: [
                {
                  find: /^react$/,
                  replacement: require.resolve("next/dist/compiled/react"),
                },
                {
                  find: /^react\/jsx-runtime$/,
                  replacement: require.resolve(
                    "next/dist/compiled/react/jsx-runtime",
                  ),
                },
                {
                  find: /^react\/jsx-dev-runtime$/,
                  replacement: require.resolve(
                    "next/dist/compiled/react/jsx-dev-runtime",
                  ),
                },
                {
                  find: /^react-dom$/,
                  replacement: require.resolve("next/dist/compiled/react-dom"),
                },
                {
                  find: /^react-dom\/server$/,
                  replacement: require.resolve(
                    "next/dist/compiled/react-dom/server.browser.js",
                  ),
                },
                {
                  find: /^react-dom\/test-utils$/,
                  replacement: require.resolve(
                    "next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js",
                  ),
                },
                {
                  find: /^react-dom\/client$/,
                  replacement: require.resolve(
                    "next/dist/compiled/react-dom/client.js",
                  ),
                },
                {
                  find: /^react-dom\/cjs\/react-dom\.development\.js$/,
                  replacement: require.resolve(
                    "next/dist/compiled/react-dom/cjs/react-dom.development.js",
                  ),
                },
              ],
            },
          }),
          optimizeDeps: {
            include: [
              "next/dist/shared/lib/app-router-context.shared-runtime",
              "next/dist/shared/lib/head-manager-context.shared-runtime",
              "next/dist/shared/lib/hooks-client-context.shared-runtime",
              "next/dist/shared/lib/router-context.shared-runtime",
              "next/dist/client/components/redirect-boundary",
              "next/dist/client/head-manager",
              "next/dist/client/components/is-next-router-error",
              "next/config",
              "next/dist/shared/lib/segment",
              "styled-jsx",
              "styled-jsx/style",
              "sb-original/image-context",
              "sb-original/default-loader",
              "next/dist/compiled/react",
              "next/image",
              "next/legacy/image",
              "react/jsx-dev-runtime",
              // Required for pnpm setups, since styled-jsx is a transitive dependency of Next.js and not directly listed.
              // Refer to this pnpm issue for more details:
              // https://github.com/vitejs/vite/issues/16293
              "next > styled-jsx/style",
            ],
          },
          test: {
            alias: {
              "react/jsx-dev-runtime": require.resolve(
                "next/dist/compiled/react/jsx-dev-runtime.js",
              ),
              "react/jsx-runtime": require.resolve(
                "next/dist/compiled/react/jsx-runtime.js",
              ),

              react: require.resolve("next/dist/compiled/react"),

              "react-dom/server": require.resolve(
                executionEnvironment === "node"
                  ? "next/dist/compiled/react-dom/server.js"
                  : "next/dist/compiled/react-dom/server.browser.js",
              ),

              "react-dom/test-utils": require.resolve(
                "next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js",
              ),

              "react-dom/cjs/react-dom.development.js": require.resolve(
                "next/dist/compiled/react-dom/cjs/react-dom.development.js",
              ),

              "react-dom/client": require.resolve(
                "next/dist/compiled/react-dom/client.js",
              ),

              "react-dom": require.resolve("next/dist/compiled/react-dom"),
            },
          },
        };
      },
      configResolved(config) {
        if (isVitestEnv && !config.test?.browser?.enabled) {
          // biome-ignore lint/style/noNonNullAssertion: test is available in the config
          config.test!.setupFiles = [
            require.resolve("./mocks/storybook.global.js"),
            ...(config.test?.setupFiles ?? []),
          ];
        }
      },
    },
    vitePluginNextFont(),
    vitePluginNextSwc(dir, nextConfigResolver),
    vitePluginNextEnv(dir, nextConfigResolver),
    vitePluginNextImage(nextConfigResolver),
    vitePluginNextMocks(),
    vitePluginNextDynamic(),
  ];
}

export default VitePlugin;
