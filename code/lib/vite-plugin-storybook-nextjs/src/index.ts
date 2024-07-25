import { resolve } from "node:path";

import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { Plugin } from "vite";
import { vitePluginNextConfig } from "./plugins/next-env/plugin";
import { configureNextFont } from "./plugins/next-font/plugin";
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

function VitePlugin({ dir = process.cwd() }: VitePluginOptions = {}): Plugin {
  const resolvedDir = resolve(dir);
  const nextConfigResolver = Promise.withResolvers<NextConfigComplete>();

  const nextFontPlugin = configureNextFont();
  const nextSwcPlugin = vitePluginNextSwc(dir, nextConfigResolver);
  const nextEnvPlugin = vitePluginNextConfig(dir, nextConfigResolver);
  const nextImagePlugin = vitePluginNextImage(nextConfigResolver);

  return {
    name: "vite-plugin-storybook-nextjs",
    enforce: "pre",

    configureServer(server) {
      nextFontPlugin.configureServer.call(this, server);
    },
    async config(config, env) {
      const phase =
        env.mode === "development"
          ? PHASE_DEVELOPMENT_SERVER
          : env.mode === "test"
            ? PHASE_TEST
            : PHASE_PRODUCTION_BUILD;

      nextConfigResolver.resolve(await loadConfig(phase, resolvedDir));

      const plugins = [
        nextSwcPlugin,
        nextEnvPlugin,
        nextFontPlugin,
        nextImagePlugin,
      ];

      let mergedConfig = config;

      for (const plugin of plugins) {
        mergedConfig = await plugin.config.call(this, mergedConfig, env);
      }

      return mergedConfig;
    },
    async resolveId(source, importer, options) {
      const nextFontResolver = await nextFontPlugin.resolveId.call(
        this,
        source,
        importer,
      );

      if (nextFontResolver) {
        return nextFontResolver;
      }

      return nextImagePlugin.resolveId.call(this, source, importer);
    },
    load(id) {
      const nextFontLoaderResult = nextFontPlugin.load.call(this, id);

      if (nextFontLoaderResult) {
        return nextFontLoaderResult;
      }

      return nextImagePlugin.load.call(this, id);
    },
    transform(code, id) {
      return nextSwcPlugin.transform.call(this, code, id);
    },
  };
}

export default VitePlugin;
