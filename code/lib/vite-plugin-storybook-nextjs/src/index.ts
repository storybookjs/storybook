import { resolve } from "node:path";
import loadJsConfig, {} from "next/dist/build/load-jsconfig";
import { findPagesDir } from "next/dist/lib/find-pages-dir";
import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { Plugin } from "vite";
import {
	getConfig,
	getConfigPaths,
	loadEnvironmentConfig,
	loadSWCBindingsEagerly,
} from "./utils/nextjs";
import { getPackageJSON } from "./utils/packageJSON";
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

	const getPagesDir = () => nextDirectories.pagesDir;
	const getHasServerComponents = () => !!nextDirectories.appDir;
	const getIsEsmProject = () => packageJSONConfig.type === "module";
	const getTranspiledPackages = () => nextConfig?.transpilePackages ?? [];
	const getJsConfig = () => loadedJSConfig.jsConfig;
	const getResolvedBaseUrl = () => loadedJSConfig.resolvedBaseUrl;

	const getVitestTransformConfig = () => ({
		modularizeImports: nextConfig.modularizeImports,
		swcPlugins: nextConfig.experimental.swcPlugins,
		compilerOptions: nextConfig?.compiler,
		jsConfig: getJsConfig(),
		resolvedBaseUrl: getResolvedBaseUrl(),
		serverComponents: getHasServerComponents(),
		isEsmProject: getIsEsmProject(),
		pagesDir: getPagesDir(),
	});

	return {
		name: "vite-plugin-next",
		async buildStart() {
			const resolvedDir = resolve(dir);

			packageJSONConfig = await getPackageJSON(resolvedDir);
			nextConfig = await getConfig(resolvedDir);
			nextDirectories = findPagesDir(resolvedDir);
			loadedJSConfig = await loadJsConfig(resolvedDir, nextConfig);

			await loadEnvironmentConfig(resolvedDir);

			// Set watchers for the Next.js configuration files
			for (const configPath of await getConfigPaths(resolvedDir)) {
				this.addWatchFile(configPath);
			}

			await loadSWCBindingsEagerly(nextConfig);
		},
		config(config, env) {
			const serverWatchIgnored = config.server?.watch?.ignored;
			const isServerWatchIgnoredArray = Array.isArray(serverWatchIgnored);
			return {
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
	};
}

export default VitePlugin;
