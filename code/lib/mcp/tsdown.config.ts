import { defineConfig } from 'tsdown';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Plugin to tree-shake JSON file imports
 *
 * Works around a rolldown tree-shaking bug where importing JSON files includes ALL properties,
 * not just the ones used in the code. This plugin intercepts JSON file loads and returns
 * only the specified properties.
 *
 * @param options - Configuration object
 * @param options.file - Path to the JSON file (relative to project root or absolute)
 * @param options.keys - Array of property names to include in the bundle
 *
 * See: https://github.com/rolldown/rolldown/issues/6614
 */
function jsonTreeShakePlugin(options: { fileName: string; keys: string[] }) {
	const { fileName, keys } = options;
	const fileId = path.isAbsolute(fileName)
		? fileName
		: path.resolve(import.meta.dirname, fileName);

	return {
		name: 'json-tree-shake',
		load: {
			// Run this plugin BEFORE other plugins (including the built-in JSON plugin)
			// This ensures our load hook is called before the JSON plugin tries to load the file
			order: 'pre',
			async handler(id: string) {
				if (id !== fileId) {
					return null;
				}

				const jsonContent = JSON.parse(await fs.readFile(fileId, 'utf-8'));

				// Create minimal JSON object with only the specified properties
				const selectedJson: Record<string, any> = {};
				for (const key of keys) {
					if (key in jsonContent) {
						selectedJson[key] = jsonContent[key];
					}
				}

				// The default plugin will still process this as JSON
				// So don't return JS here
				return {
					code: JSON.stringify(selectedJson, null, 2),
					moduleSideEffects: false,
				};
			},
		},
	};
}

export default defineConfig({
	plugins: [
		jsonTreeShakePlugin({
			fileName: 'package.json',
			keys: ['name', 'version', 'description'],
		}),
	],
});
