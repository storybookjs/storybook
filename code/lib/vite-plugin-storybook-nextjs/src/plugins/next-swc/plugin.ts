import { resolve } from "node:path";
import type { Env } from "@next/env";
import loadJsConfig from "next/dist/build/load-jsconfig";
import { transform } from "next/dist/build/swc";
import { findPagesDir } from "next/dist/lib/find-pages-dir";
import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { Plugin } from "vite";

import * as NextUtils from "../../utils/nextjs";
import { getVitestSWCTransformConfig } from "../../utils/swc/transform";
import { isDefined } from "../../utils/typescript";

/** Regular expression to exclude certain files from transformation */
const excluded =
	/[\\/](cache[\\/][^\\/]+\.zip[\\/]node_modules|virtual:)[\\/]/g;

const included = /\.((c|m)?(j|t)sx?)$/;

export function vitePluginNextSwc(
	rootDir: string,
	nextConfigResolver: PromiseWithResolvers<NextConfigComplete>,
) {
	let loadedJSConfig: Awaited<ReturnType<typeof loadJsConfig>>;
	let nextDirectories: ReturnType<typeof findPagesDir>;
	let isServerEnvironment: boolean;
	let envConfig: Env;
	let isDev: boolean;

	const resolvedDir = resolve(rootDir);

	return {
		name: "vite-plugin-next-swc",
		async config(config, env) {
			const nextConfig = await nextConfigResolver.promise;
			nextDirectories = findPagesDir(resolvedDir);
			loadedJSConfig = await loadJsConfig(resolvedDir, nextConfig);
			envConfig = (await NextUtils.loadEnvironmentConfig(resolvedDir))
				.combinedEnv;
			isDev = env.mode === "development";

			await NextUtils.loadSWCBindingsEagerly(nextConfig);

			const serverWatchIgnored = config.server?.watch?.ignored;
			const isServerWatchIgnoredArray = Array.isArray(serverWatchIgnored);

			if (
				config.test?.environment === "node" ||
				config.test?.environment === "edge-runtime" ||
				config.test?.browser?.enabled !== false
			) {
				isServerEnvironment = true;
			}

			return {
				resolve: {
					alias: {
						"@opentelemetry/api": "next/dist/compiled/@opentelemetry/api",
					},
				},
				esbuild: {
					// We will use Next.js custom SWC transpiler instead of Vite's build-in esbuild
					exclude: [/node_modules/, /.m?(t|j)sx?/],
				},
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
			if (!excluded.test(id) && included.test(id)) {
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
					}),
				);

				return output;
			}
		},
	} satisfies Plugin;
}
