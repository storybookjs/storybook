import { resolve } from "node:path";

import { createRequire } from "node:module";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";
import type { Plugin } from "vite";
import { vitePluginNextEnv } from "./plugins/next-env/plugin";
import { vitePluginNextFont } from "./plugins/next-font/plugin";
import { vitePluginNextSwc } from "./plugins/next-swc/plugin";

import "./polyfills/promise-with-resolvers";
import loadConfig from "next/dist/server/config.js";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_TEST,
} from "next/dist/shared/lib/constants.js";
import { vitePluginNextImage } from "./plugins/next-image/plugin";
import { vitePluginNextMocks } from "./plugins/next-mocks/plugin";
import { isVitestEnv } from "./utils";

const require = createRequire(import.meta.url);

type VitePluginOptions = {
  /**
   * Provide the path to your Next.js project directory
   * @default process.cwd()
   */
  dir?: string;
};

function VitePlugin({ dir = process.cwd() }: VitePluginOptions = {}): Plugin[] {
  const resolvedDir = resolve(dir);
  const nextConfigResolver = Promise.withResolvers<NextConfigComplete>();

  return [
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

        return {
          ...(!isVitestEnv && {
            resolve: {
              alias: {
                react: "next/dist/compiled/react",
                "react-dom": "next/dist/compiled/react-dom",
              },
            },
          }),
          test: {
            alias: {
              "react/jsx-dev-runtime": require.resolve(
                "next/dist/compiled/react/jsx-dev-runtime.js",
              ),
              "react/jsx-runtime": require.resolve(
                "next/dist/compiled/react/jsx-runtime.js",
              ),

              react: require.resolve("next/dist/compiled/react"),

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
        if (!config.test?.browser?.enabled) {
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
  ];
}

export default VitePlugin;
