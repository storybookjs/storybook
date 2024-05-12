import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import type { Config } from "@sveltejs/kit";
import MagicString from "magic-string";
import { createFilter, type Plugin } from "vite";
import { preprocess } from "svelte/compiler";

import { extractStories } from "../parser/extract-stories.js";
import { getNameFromFilename } from "../parser/svelte-stories-loader.js";

const parser = fileURLToPath(
	new URL("../parser/collect-stories.js", import.meta.url),
).replace(/\\/g, "\\\\"); // For Windows paths

export default function csfPlugin(svelteOptions: Config): Plugin {
	const include = /\.stories\.svelte$/;
	const filter = createFilter(include);

	return {
		name: "storybook:addon-svelte-csf-plugin",
		enforce: "post",
		async transform(code, id) {
			if (!filter(id)) return undefined;

			const s = new MagicString(code);
			const component = getNameFromFilename(id);

			let source = readFileSync(id).toString();

			if (svelteOptions && svelteOptions.preprocess) {
				source = (
					await preprocess(source, svelteOptions.preprocess, {
						filename: id,
					})
				).code;
			}

			const storiesFileMeta = extractStories(source);
			const { fragment } = storiesFileMeta;
			const { stories } = fragment;
			// biome-ignore format: Stop
			const storiesExports = Object.entries(stories)
        .map(
          ([id]) =>
            `export const ${sanitizeStoryId(id)} = __storiesMetaData.stories[${JSON.stringify(id)}];`
        )
        .join('\n');

			s.replace("export default", "// export default");

			const namedExportsOrder = Object.entries(stories).map(([id, _]) => id);

			/* biome-ignore format: Stop */
			const output = [
        '',
        `import parser from '${parser}';`,
        `const __storiesMetaData = parser(${component}, ${JSON.stringify(storiesFileMeta)}, meta);`,
        'export default __storiesMetaData.meta;',
        `export const __namedExportsOrder = ${JSON.stringify(namedExportsOrder)};`,
        storiesExports,
      ].join('\n');

			s.append(output);

			return {
				code: s.toString(),
				map: s.generateMap({ hires: true, source: id }),
			};
		},
	};
}

function sanitizeStoryId(id: string) {
	return id.replace(/\s|-/g, "_");
}
