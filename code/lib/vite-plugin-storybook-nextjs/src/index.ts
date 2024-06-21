import { resolve } from "node:path";
import loadJsConfig from "next/dist/build/load-jsconfig";
import { minify, transform } from "next/dist/build/swc";
import { findPagesDir } from "next/dist/lib/find-pages-dir";
import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { Plugin } from "vite";
import * as NextUtils from "./utils/nextjs";
import { getPackageJSON } from "./utils/packageJSON";
import { getVitestSWCTransformConfig } from "./utils/swc/transform";
import { isDefined } from "./utils/typescript";

type VitePluginOptions = {
	/**
	 * Provide the path to your Next.js project directory
	 * @default process.cwd()
	 */
	dir?: string;
};

function VitePlugin({ dir = process.cwd() }: VitePluginOptions = {}): Plugin {
	let nextConfig: NextConfigComplete;
	let packageJSONConfig: Awaited<ReturnType<typeof getPackageJSON>>;
	let loadedJSConfig: Awaited<ReturnType<typeof loadJsConfig>>;
	let nextDirectories: ReturnType<typeof findPagesDir>;
	let isServerEnvironment: boolean;

	const getTranspiledPackages = () => nextConfig?.transpilePackages ?? [];

	return {
		name: "vite-plugin-next",
		async buildStart() {
			const resolvedDir = resolve(dir);

			packageJSONConfig = await getPackageJSON(resolvedDir);
			nextConfig = await NextUtils.getConfig(resolvedDir);
			nextDirectories = findPagesDir(resolvedDir);
			loadedJSConfig = await loadJsConfig(resolvedDir, nextConfig);

			await NextUtils.loadEnvironmentConfig(resolvedDir);

			// Set watchers for the Next.js configuration files
			for (const configPath of await NextUtils.getConfigPaths(resolvedDir)) {
				this.addWatchFile(configPath);
			}

			await NextUtils.loadSWCBindingsEagerly(nextConfig);
		},
		config(config, env) {
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
					packageJSONConfig,
				}),
			);

			return output;
		},
	};
}

export default VitePlugin;
