import { compile, type Root } from "svelte/compiler";

import type { StoriesFileMeta } from "./types.js";
import { walkOnModule } from "./walkers/module.js";
import { walkOnFragment } from "./walkers/fragment.js";

/**
 * Parse raw stories file component in Svelte format,
 * and extract the most stories file meta,
 * which are required to generate `StoryFn's` for `@storybook/svelte` components.
 */
export function extractStories(rawSource: string): StoriesFileMeta {
	const { ast }: { ast: Root } = compile(rawSource, { modernAst: true });
	const { module, fragment } = ast;

	const moduleMeta = walkOnModule(module);
	const fragmentMeta = walkOnFragment({
		fragment,
		rawSource,
		addonComponentName: moduleMeta.addonComponentName,
	});

	return {
		module: moduleMeta,
		fragment: fragmentMeta,
	};
}
