import { resolve } from "node:path";

import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { Plugin } from "vite";
import { vitePluginNextConfig } from "./plugins/next-env/plugin";
import { configureNextFont } from "./plugins/next-font/plugin";
import { vitePluginNextSwc } from "./plugins/next-swc/plugin";
import * as NextUtils from "./utils/nextjs";

import "./polyfills/promise-with-resolvers";
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
	const nextEnvPlugin = vitePluginNextConfig(dir);
	const nextImagePlugin = vitePluginNextImage(nextConfigResolver);

	return {
		name: "vite-plugin-next",
		async buildStart() {
			// Set watchers for the Next.js configuration files
			for (const configPath of await NextUtils.getConfigPaths(resolvedDir)) {
				this.addWatchFile(configPath);
			}
		},
		enforce: "pre",
		configureServer(server) {
			nextFontPlugin.configureServer.call(this, server);
		},
		async config(config, env) {
			nextConfigResolver.resolve(await NextUtils.getConfig(resolvedDir));

			const mergedNextSwcConfig = await nextSwcPlugin.config.call(
				this,
				config,
				env,
			);
			const mergedNextEnvConfig = await nextEnvPlugin.config.call(
				this,
				mergedNextSwcConfig,
				env,
			);
			const mergedNextFontConfig = await nextFontPlugin.config.call(
				this,
				mergedNextEnvConfig,
				env,
			);

			const mergedNextImageConfig = await nextImagePlugin.config.call(
				this,
				mergedNextFontConfig,
				env,
			);

			return mergedNextImageConfig;
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
