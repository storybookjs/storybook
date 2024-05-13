/* eslint-env browser */
import { logger } from "@storybook/client-logger";
import { combineParameters } from "@storybook/preview-api";
import type { Meta, StoryObj } from "@storybook/svelte";
import { deepmerge } from "deepmerge-ts";
import {
	type ComponentProps,
	type SvelteComponent,
	mount,
	unmount,
} from "svelte";

import type { StoriesFileMeta } from "./types.js";
import type { StoriesRepository } from "../components/context.svelte.js";

import RenderContext from "../components/RenderContext.svelte";
import StoriesExtractor from "../components/StoriesExtractor.svelte";

const createFragment = document.createDocumentFragment
	? () => document.createDocumentFragment()
	: () => document.createElement("div");

/**
 * @module
 * Called from a webpack loader and a jest transformation.
 *
 * It mounts a Stories component in a context which disables
 * the rendering of every <Story/> and <Template/> but instead
 * collects names and properties.
 *
 * For every discovered <Story/>, it creates a storyFn which
 * instantiate the main Stories component: Every Story but
 * the one selected is disabled.
 */
export default <Component extends SvelteComponent>(
	Stories: Component,
	storiesFileMeta: StoriesFileMeta,
	meta: Meta<Component>,
) => {
	if (!meta.parameters?.docs?.description?.component) {
		meta.parameters = combineParameters(meta.parameters, {
			docs: {
				description: {
					component: storiesFileMeta.module.description,
				},
			},
		});
	}

	const repository: StoriesRepository<Component> = {
		meta,
		templates: new Map(),
		stories: new Map(),
	};

	// extract all stories
	try {
		const context = mount(StoriesExtractor, {
			target: createFragment() as Element,
			props: {
				Stories,
				repository: () => repository,
			} satisfies ComponentProps<StoriesExtractor>,
		});

		unmount(context);
	} catch (e: any) {
		logger.error(`Error in mounting stories ${e.toString()}`, e);
	}

	const stories: Record<string, StoryObj<Component>> = {};

	for (const [name, story] of repository.stories) {
		const { templateId } = story;
		const template = templateId && repository.templates.get(templateId);
		const templateMeta =
			templateId && storiesFileMeta.fragment.templates[templateId];
		const storyMeta = storiesFileMeta.fragment.stories[name];

		const play = deepmerge(meta.play, template?.play, story.play);

		const storyObj: StoryObj<Meta> = {
			...story,
			// component: meta.component,
			args: deepmerge({}, meta.args, template?.args, story.args),
			// Stories,
			parameters: deepmerge(template?.parameters, story.parameters, {
				docs: {
					description: {
						story: storyMeta.description,
					},
					source: {
						code: storyMeta.rawSource ?? templateMeta?.rawSource,
					},
				},
				storySource: {
					source: storyMeta.rawSource ?? templateMeta?.rawSource,
				},
			}),
			render: (componentAnnotations, storyContext) => ({
				Component: RenderContext,
				props: {
					Stories,
					storyContext,
				} satisfies ComponentProps<RenderContext>,
			}),
		};

		if (play) {
			/*
			 * The 'play' function should be delegated to the real play Story function
			 * in order to be run into the component scope.
			 */
			storyObj.play = (storyContext) => {
				const delegate = storyContext?.playFunction?.__play;

				if (delegate) {
					return delegate(storyContext);
				}

				return play(storyContext);
			};
		}

		Object.assign(stories, { [name]: storyObj });
	}

	// for (const [name, story] of repository.stories) {
	// 	const { templateId } = story;
	// 	const template = templateId && repository.templates.get(templateId);
	// 	const templateMeta =
	// 		templateId && storiesFileMeta.fragment.templates[templateId];
	// 	const storyMeta = storiesFileMeta.fragment.stories[name];
	//
	// 	// NOTE: It cannot be moved to `StoryObj`, because of `@storybook/svelte` and `PreviewRenderer` - it accepts fn's
	// 	const storyFn: StoryFn = (args, storyContext) => {
	// 		const props: ComponentProps<RenderContext> = {
	// 			// FIXME: Is this the right direction?
	// 			// ...deepmerge(meta, template, story),
	// 			Stories,
	// 			name,
	// 			args,
	// 			sourceComponent: meta.component,
	// 			storyContext,
	// 			templateId,
	// 		};
	//
	// 		return {
	// 			Component: RenderContext,
	// 			props,
	// 		};
	// 	};
	// 	storyFn.storyName = name;
	// 	// FIXME: Is this the right direction?
	// 	storyFn.args = deepmerge({}, meta.args, template?.args, story.args);
	// 	// FIXME: Is this the right direction?
	// 	storyFn.parameters = deepmerge(template?.parameters, story.parameters, {
	// 		docs: {
	// 			description: {
	// 				story: storyMeta.description,
	// 			},
	// 			source: {
	// 				code: storyMeta.rawSource ?? templateMeta?.rawSource,
	// 			},
	// 		},
	// 		storySource: {
	// 			source: storyMeta.rawSource ?? templateMeta?.rawSource,
	// 		},
	// 	});
	//
	// 	// FIXME: Is this the right direction?
	// 	const play = deepmerge(meta.play, template?.play, story.play);
	//
	// 	if (play) {
	// 		/*
	// 		 * The 'play' function should be delegated to the real play Story function
	// 		 * in order to be run into the component scope.
	// 		 */
	// 		storyFn.play = (storyContext) => {
	// 			const delegate = storyContext?.playFunction?.__play;
	// 			if (delegate) {
	// 				return delegate(storyContext);
	// 			}
	//
	// 			return play(storyContext);
	// 		};
	// 	}
	//
	// 	Object.assign(stories, { [name]: storyFn });
	// }

	console.log("PARSER", { meta, stories, repository });

	return { meta, stories };
};
