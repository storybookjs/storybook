import { resolve } from "node:path";

import type { Plugin } from "vite";
import { vitePluginNextConfig } from "./plugins/next-env/plugin";
import { configureNextFont } from "./plugins/next-font/plugin";
import { vitePluginNextSwc } from "./plugins/next-swc/plugin";
import * as NextUtils from "./utils/nextjs";

type VitePluginOptions = {
	/**
	 * Provide the path to your Next.js project directory
	 * @default process.cwd()
	 */
	dir?: string;
};

function VitePlugin({ dir = process.cwd() }: VitePluginOptions = {}): Plugin {
	const resolvedDir = resolve(dir);

	const nextFontPlugin = configureNextFont();
	const nextSwcPlugin = vitePluginNextSwc(dir);
	const nextEnvPlugin = vitePluginNextConfig(dir);

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

			return mergedNextFontConfig;
		},
		resolveId(source, importer, options) {
			return nextFontPlugin.resolveId.call(this, source, importer);
		},
		load(id) {
			return nextFontPlugin.load.call(this, id);
		},
		transform(code, id) {
			return nextSwcPlugin.transform.call(this, code, id);
		},
	};
}

export default VitePlugin;
