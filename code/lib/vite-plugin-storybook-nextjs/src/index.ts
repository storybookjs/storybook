import { resolve } from "node:path";
import type { Env } from "@next/env";
import loadJsConfig from "next/dist/build/load-jsconfig";
import { transform } from "next/dist/build/swc";
import { getDefineEnv } from "next/dist/build/webpack/plugins/define-env-plugin";
import { findPagesDir } from "next/dist/lib/find-pages-dir";
import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { Plugin } from "vite";
import { configureNextFont } from "./plugins/next-font/plugin";
import * as NextUtils from "./utils/nextjs";
import { getVitestSWCTransformConfig } from "./utils/swc/transform";
import { isDefined } from "./utils/typescript";

/** Regular expression to exclude certain files from transformation */
const excluded =
	/[\\/](cache[\\/][^\\/]+\.zip[\\/]node_modules|virtual:)[\\/]/g;

const included = /\.((c|m)?(j|t)sx?)$/;

type VitePluginOptions = {
	/**
	 * Provide the path to your Next.js project directory
	 * @default process.cwd()
	 */
	dir?: string;
};

function VitePlugin({ dir = process.cwd() }: VitePluginOptions = {}): Plugin {
	const resolvedDir = resolve(dir);

	let nextConfig: NextConfigComplete;
	let loadedJSConfig: Awaited<ReturnType<typeof loadJsConfig>>;
	let nextDirectories: ReturnType<typeof findPagesDir>;
	let isServerEnvironment: boolean;
	let envConfig: Env;
	let isDev: boolean;

	const getTranspiledPackages = () => nextConfig?.transpilePackages ?? [];

	const nextFontPlugin = configureNextFont();

	return {
		name: "vite-plugin-next",
		async buildStart() {
			// Set watchers for the Next.js configuration files
			for (const configPath of await NextUtils.getConfigPaths(resolvedDir)) {
				this.addWatchFile(configPath);
			}
		},
		enforce: "pre",
		resolveId(source, importer, options) {
			return nextFontPlugin.resolveId.call(this, source, importer, options);
		},
		load(id) {
			return nextFontPlugin.load.call(this, id);
		},
		async config(config, env) {
			nextConfig = await NextUtils.getConfig(resolvedDir);
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

			const publicNextEnvMap = Object.fromEntries(
				Object.entries(envConfig)
					.filter(([key]) => key.startsWith("NEXT_PUBLIC_"))
					.map(([key, value]) => {
						return [`process.env.${key}`, JSON.stringify(value)];
					}),
			);

			return {
				define: {
					...publicNextEnvMap,
					...getDefineEnv({
						isTurbopack: false,
						config: nextConfig,
						isClient: true,
						isEdgeServer: false,
						isNodeOrEdgeCompilation: false,
						isNodeServer: false,
						clientRouterFilters: undefined,
						dev: isDev,
						middlewareMatchers: undefined,
						hasRewrites: false,
						distDir: nextConfig.distDir,
						fetchCacheKeyPrefix: nextConfig?.experimental?.fetchCacheKeyPrefix,
					}),
				},
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
						nextConfig,
						nextDirectories,
						rootDir: dir,
						isDev,
					}),
				);

				return output;
			}
		},
	};
}

export default VitePlugin;
