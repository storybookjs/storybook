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

        nextConfigResolver.resolve(
          // @ts-ignore TODO figure out why TypeScript is complaining about this
          await loadConfig.default(phase, resolvedDir),
        );

        return config;
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
