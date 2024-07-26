import { resolve } from "node:path";

import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { Plugin } from "vite";
import { vitePluginNextConfig } from "./plugins/next-env/plugin";
import { vitePluginNextFont } from "./plugins/next-font/plugin";
import { vitePluginNextSwc } from "./plugins/next-swc/plugin";

import "./polyfills/promise-with-resolvers";
import loadConfig from "next/dist/server/config";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_TEST,
} from "next/dist/shared/lib/constants";
import { vitePluginNextImage } from "./plugins/next-image/plugin";

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
      enforce: "pre",
      async config(config, env) {
        const phase =
          env.mode === "development"
            ? PHASE_DEVELOPMENT_SERVER
            : env.mode === "test"
              ? PHASE_TEST
              : PHASE_PRODUCTION_BUILD;

        nextConfigResolver.resolve(await loadConfig(phase, resolvedDir));

        return {
          resolve: {
            alias: {
              react: "next/dist/compiled/react",
              "react-dom/test-utils": "react-dom/test-utils",
              "react-dom": "next/dist/compiled/react-dom",
            },
          },
        };
      },
    },
    vitePluginNextFont(),
    vitePluginNextSwc(dir, nextConfigResolver),
    vitePluginNextConfig(dir, nextConfigResolver),
    vitePluginNextImage(nextConfigResolver),
  ];
}

export default VitePlugin;
