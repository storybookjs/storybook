import type { McpServer } from 'tmcp';
import url from 'node:url';
import * as v from 'valibot';
import { collectTelemetry } from '../telemetry.ts';
import { buildArgsParam } from '../utils/build-args-param.ts';
import { getStoryIndex } from '../utils/get-story-index.ts';
import { findStoryIds } from '../utils/find-story-ids.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonContext } from '../types.ts';
import { StoryInput, StoryInputArray } from '../types.ts';
import appTemplate from './preview-stories/preview-stories-app-template.html';
import fs from 'node:fs/promises';
import { PREVIEW_STORIES_TOOL_NAME } from './tool-names.ts';

export const PREVIEW_STORIES_RESOURCE_URI = `ui://${PREVIEW_STORIES_TOOL_NAME}/preview.html`;

// With review enabled this is strictly a mid-loop tool: no "include the URLs
// in your final response" default (that sanctioned preview links as the
// ending of visual work) and no hedging about display-review's availability
// (a hedged "when available" clause let an agent that wrongly believed the
// review tool was missing treat raw links as a sanctioned fallback). When
// review is disabled the tool is not registered, so the description must not
// mention it at all.
export function getPreviewStoriesToolDescription({
	reviewEnabled = false,
}: { reviewEnabled?: boolean } = {}): string {
	if (!reviewEnabled) {
		return `Use this tool to get one or more Storybook preview URLs.
Call it after editing anything that changes how the UI looks — components, stories, styles, CSS, themes, colors, or design tokens — no exceptions. A shared file has no stories of its own: preview the stories of the components that consume it.
Include each returned preview URL in your final user-facing response so users can open them directly.`;
	}

	return `Use this tool to get Storybook preview URLs while iterating on a specific story, or when the user asks for a direct link to one.
Do not end visual work or browse requests with these links — publish a curated review with display-review instead (passing changedFiles: [] when no code changed) and link that.`;
}

export const PreviewStoriesInput = v.object({
	stories: v.pipe(
		StoryInputArray,
		v.description(
			`Stories to preview.
Prefer { storyId } when you don't already have story file context, since this avoids filesystem discovery.
Use { storyId } when IDs were discovered from documentation tools.
Use { absoluteStoryPath + exportName } only when you're already working in a specific .stories.* file and already have that context.`,
		),
	),
});

export const PreviewStoriesOutput = v.object({
	stories: v.array(
		v.union([
			v.object({
				title: v.string(),
				name: v.string(),
				previewUrl: v.pipe(
					v.string(),
					v.description(
						'Direct URL to open the story preview. Include this URL in the final user-facing response so users can open it directly — unless a curated review page is being published via display-review, in which case link the review page instead of listing individual URLs.',
					),
				),
			}),
			v.object({
				input: StoryInput,
				error: v.string(),
			}),
		]),
	),
});

export type PreviewStoriesInput = v.InferOutput<typeof PreviewStoriesInput>;
export type PreviewStoriesOutput = v.InferOutput<typeof PreviewStoriesOutput>;

export function getPreviewStoriesToolMetadata({
	reviewEnabled = false,
}: { reviewEnabled?: boolean } = {}) {
	return {
		name: PREVIEW_STORIES_TOOL_NAME,
		title: 'Get story preview URLs',
		description: getPreviewStoriesToolDescription({ reviewEnabled }),
		schema: PreviewStoriesInput,
		outputSchema: PreviewStoriesOutput,
		_meta: { ui: { resourceUri: PREVIEW_STORIES_RESOURCE_URI } },
	};
}

export async function addPreviewStoriesTool(
	server: McpServer<any, AddonContext>,
	enabled: Parameters<McpServer<any, AddonContext>['tool']>[0]['enabled'] = () =>
		server.ctx.custom?.toolsets?.dev ?? true,
	{ reviewEnabled = false }: { reviewEnabled?: boolean } = {},
) {
	const previewStoryAppScript = await fs.readFile(
		url.fileURLToPath(
			import.meta.resolve('@storybook/addon-mcp/internal/preview-stories-app-script'),
		),
		'utf-8',
	);

	const appHtml = appTemplate.replace('// APP_SCRIPT_PLACEHOLDER', previewStoryAppScript);

	server.resource(
		{
			name: PREVIEW_STORIES_RESOURCE_URI,
			description: 'App resource for the Preview Stories tool',
			uri: PREVIEW_STORIES_RESOURCE_URI,
			mimeType: 'text/html;profile=mcp-app',
		},
		() => {
			const origin = server.ctx.custom!.origin;
			return {
				contents: [
					{
						uri: PREVIEW_STORIES_RESOURCE_URI,
						mimeType: 'text/html;profile=mcp-app',
						text: appHtml,
						_meta: {
							ui: {
								prefersBorder: false,
								domain: origin,
								csp: {
									connectDomains: [origin],
									resourceDomains: [origin],
									frameDomains: [origin],
									baseUriDomains: [origin],
								},
							},
						},
					},
				],
			};
		},
	);

	server.tool(
		{
			...getPreviewStoriesToolMetadata({ reviewEnabled }),
			enabled,
		},
		async (input) => {
			try {
				const { origin, options, disableTelemetry } = server.ctx.custom ?? {};

				if (!origin) {
					throw new Error('Origin is required in addon context');
				}
				if (!options) {
					throw new Error('Storybook options are required in addon context');
				}

				const index = await getStoryIndex(options);
				const resolvedStories = findStoryIds(index, input.stories);

				const structuredResult: PreviewStoriesOutput['stories'] = [];
				const textResult: string[] = [];

				for (const story of resolvedStories) {
					if ('errorMessage' in story) {
						structuredResult.push({
							input: story.input,
							error: story.errorMessage,
						});
						textResult.push(story.errorMessage);
						continue;
					}

					const indexEntry = index.entries[story.id];
					if (!indexEntry) {
						structuredResult.push({
							input: story.input,
							error: `No story found for story ID "${story.id}"`,
						});
						textResult.push(`No story found for story ID "${story.id}"`);
						continue;
					}

					let previewUrl = `${origin}/?path=/story/${story.id}`;

					// Add props as args query param if provided
					const argsParam = buildArgsParam(story.input.props ?? {});
					if (argsParam) {
						previewUrl += `&args=${argsParam}`;
					}

					// Add globals query param if provided
					const globalsParam = buildArgsParam(story.input.globals ?? {});
					if (globalsParam) {
						previewUrl += `&globals=${globalsParam}`;
					}

					structuredResult.push({
						title: indexEntry.title,
						name: indexEntry.name,
						previewUrl,
					});
					textResult.push(previewUrl);
				}

				if (!disableTelemetry) {
					await collectTelemetry({
						event: 'tool:previewStories',
						server,
						toolset: 'dev',
						inputStoryCount: input.stories.length,
						outputStoryCount: structuredResult.length,
					});
				}

				const content: Array<{ type: 'text'; text: string }> = textResult.map((text) => ({
					type: 'text',
					text,
				}));

				// Recovery nudge for the review exit ramp: agents that skip
				// display-review (observed: an agent wrongly claimed the tool was
				// not exposed) end visual work on exactly this call, so the result
				// itself must contradict that belief while there is still a step
				// left to recover in. Only when at least one URL resolved — an
				// all-error result has nothing to curate into a review.
				const resolvedAnyStory = structuredResult.some((story) => 'previewUrl' in story);
				if (reviewEnabled && resolvedAnyStory) {
					content.push({
						type: 'text',
						text: `These preview links are for iterating or sharing a specific story — they are not how visual work or a browse request ends. The display-review tool is available in this session: if you are finishing visually observable work or showing a set of stories, publish the review with **display-review** and link that instead.`,
					});
				}

				return {
					content,
					structuredContent: {
						stories: structuredResult,
					},
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
