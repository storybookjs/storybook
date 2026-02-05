import nextLoadJsConfig from "next/dist/build/load-jsconfig.js";
import { transform } from "next/dist/build/swc/index.js";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";
import { resolve } from "pathe";
import { type Plugin, createFilter } from "vite";

import { isVitestEnv } from "../../utils";
import * as NextUtils from "../../utils/nextjs";
import { getVitestSWCTransformConfig } from "../../utils/swc/transform";
import { isDefined } from "../../utils/typescript";

/** Regular expression to exclude certain files from transformation */
const excluded = /[\\/]((cache[\\/][^\\/]+\.zip[\\/])|virtual:)[\\/]/;

const included = /\.((c|m)?(j|t)sx?)$/;

const loadJsConfig: typeof nextLoadJsConfig =
  // biome-ignore lint/suspicious/noExplicitAny: CJS support
  (nextLoadJsConfig as any).default || nextLoadJsConfig;

export function vitePluginNextSwc(
  rootDir: string,
  nextConfigResolver: PromiseWithResolvers<NextConfigComplete>,
) {
  let loadedJSConfig: Awaited<ReturnType<typeof loadJsConfig>>;
  let nextDirectories: ReturnType<typeof NextUtils.findNextDirectories>;
  let isServerEnvironment: boolean;
  let isDev: boolean;
  let isEsmProject: boolean;
  const filter = createFilter(included, excluded);

  const resolvedDir = resolve(rootDir);

  return {
    name: "vite-plugin-storybook-nextjs-swc",
    enforce: "pre" as const,
    async config(config, env) {
      const nextConfig = await nextConfigResolver.promise;
      nextDirectories = NextUtils.findNextDirectories(resolvedDir);
      loadedJSConfig = await loadJsConfig(resolvedDir, nextConfig);
      isDev = env.mode !== "production";
      isEsmProject = true;
      // TODO: Setting isEsmProject to false errors. Need to investigate further.
      // isEsmProject = packageJson.type === "module";

      await NextUtils.loadSWCBindingsEagerly(nextConfig);

      const serverWatchIgnored = config.server?.watch?.ignored;
      const isServerWatchIgnoredArray = Array.isArray(serverWatchIgnored);

      // Default to browser-mode (Storybook preview / Vite dev).
      isServerEnvironment = false;

      // In Vitest, default to server-mode unless browser mode is explicitly enabled.
      // This avoids Next/SWC folding `typeof window` to `"undefined"` in Storybook's browser preview
      // when `config.test` is absent.
      if (isVitestEnv) {
        isServerEnvironment =
          config.test?.environment === "node" ||
          config.test?.environment === "edge-runtime" ||
          config.test?.browser?.enabled !== true;
      }

      return {
        // esbuild: {
        //   // We will use Next.js custom SWC transpiler instead of Vite's build-in esbuild
        //   exclude: [/node_modules/, /.m?(t|j)sx?/],
        // },
        server: {
          watch: {
            ignored: [
              ...(isServerWatchIgnoredArray
                ? serverWatchIgnored
                : [serverWatchIgnored]),
              "/.next/",
            ].filter(isDefined),
          },
        },
      };
    },
    async transform(code, id) {
      if (id.includes("/node_modules/") || !filter(id)) {
        return;
      }

      const inputSourceMap = this.getCombinedSourcemap();

      const output = await transform(
        code,
        getVitestSWCTransformConfig({
          filename: id,
          inputSourceMap,
          isServerEnvironment,
          loadedJSConfig,
          nextConfig: await nextConfigResolver.promise,
          nextDirectories,
          rootDir,
          isDev,
          isEsmProject,
        }),
      );

      return output;
    },
  } satisfies Plugin;
}
