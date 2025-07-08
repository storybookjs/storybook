import { resolve } from "node:path";
import type { Env } from "@next/env";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";
import type { Plugin } from "vite";

import type { DefineEnvOptions } from "next/dist/build/define-env";
import * as NextUtils from "../../utils/nextjs";

export function vitePluginNextEnv(
  rootDir: string,
  nextConfigResolver: PromiseWithResolvers<NextConfigComplete>,
) {
  let envConfig: Env;
  let isDev: boolean;

  const resolvedDir = resolve(rootDir);

  // Try Next.js >= 15.4.0
  const getDefineEnvModule = import("next/dist/build/define-env.js")
    .then((mod) => ({
      getDefineEnv: mod.getDefineEnv,
      isNext1540: true,
    }))
    .catch(() => {
      // Fallback for Next.js < 15.4.0
      return import(
        // @ts-expect-error this module only exists in versions below 15.4.0, but this package depends on version 15.4.0 or higher.
        "next/dist/build/webpack/plugins/define-env-plugin.js"
      ).then((mod) => ({
        getDefineEnv:
          mod.getDefineEnv as typeof import("next/dist/build/define-env").getDefineEnv,
        isNext1540: false,
      }));
    });

  return {
    name: "vite-plugin-storybook-nextjs-env",
    enforce: "pre" as const,
    async config(config, env) {
      isDev = env.mode !== "production";
      envConfig = (await NextUtils.loadEnvironmentConfig(resolvedDir, isDev))
        .combinedEnv;

      const nextConfig = await nextConfigResolver.promise;

      const publicNextEnvMap = Object.fromEntries(
        Object.entries(envConfig)
          .filter(([key]) => key.startsWith("NEXT_PUBLIC_"))
          .map(([key, value]) => {
            return [`process.env.${key}`, JSON.stringify(value)];
          }),
      );

      const { getDefineEnv, isNext1540 } = await getDefineEnvModule;

      const finalConfig = {
        ...config.define,
        ...publicNextEnvMap,
        ...getDefineEnv({
          isTurbopack: false,
          config: nextConfig,
          isClient: true,
          isEdgeServer: false,
          isNodeServer: false,
          clientRouterFilters: undefined,
          dev: isDev,
          middlewareMatchers: undefined,
          hasRewrites: false,
          distDir: nextConfig.distDir,
          fetchCacheKeyPrefix: nextConfig?.experimental?.fetchCacheKeyPrefix,
          ...(isNext1540
            ? {
                projectPath: rootDir,
              }
            : {
                isNodeOrEdgeCompilation: false,
              }),
        } as DefineEnvOptions),
      };

      // NEXT_IMAGE_OPTS is used by next/image to pass options to the loader
      // it doesn't get properly serialized by Vitest (Vite seems to be fine) so we need to remove it
      // for now
      // biome-ignore lint/performance/noDelete: <explanation>
      delete process.env.__NEXT_IMAGE_OPTS;
      // biome-ignore lint/performance/noDelete: <explanation>
      delete finalConfig["process.env.__NEXT_IMAGE_OPTS"];

      return {
        define: finalConfig,
        test: {
          deps: {
            optimizer: {
              ssr: {
                include: ["next"],
              },
            },
          },
        },
      };
    },
  } satisfies Plugin;
}
