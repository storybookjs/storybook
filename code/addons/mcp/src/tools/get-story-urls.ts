import type { McpServer } from 'tmcp';
import path from 'node:path';
import { createUIResource } from '@mcp-ui/server';
import { storyNameFromExport } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/node-logger';
import * as v from 'valibot';
import { collectTelemetry } from '../telemetry.ts';
import { fetchStoryIndex } from '../utils/fetch-story-index.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonContext } from '../types.ts';
import { StoryInput, StoryInputArray } from '../types.ts';
import previewHtml from './preview.html';

export const PREVIEW_STORIES_TOOL_NAME = 'preview-story';
export const PREVIEW_STORIES_RESOURCE_URI = `ui://${PREVIEW_STORIES_TOOL_NAME}/preview.html`;

const GetStoryUrlsInput = v.object({
	stories: StoryInputArray,
});

const GetStoryUrlsOutput = v.object({
	stories: v.array(
		v.union([
			v.object({
				title: v.string(),
				name: v.string(),
				previewUrl: v.string(),
			}),
			v.object({
				input: StoryInput,
				error: v.string(),
			}),
		]),
	),
});

type GetStoryUrlsInput = v.InferOutput<typeof GetStoryUrlsInput>;
type GetStoryUrlsOutput = v.InferOutput<typeof GetStoryUrlsOutput>;

export async function addGetStoryUrlsTool(
	server: McpServer<any, AddonContext>,
) {
	// // console.log(previewHtml);
	// const storyPreviewResource = createUIResource({
	// 	uri: GET_STORY_URLS_RESOURCE_URI,
	// 	encoding: 'text',
	// 	content: {
	// 		type: 'rawHtml',
	// 		htmlString: previewHtml,
	// 	},
	// 	uiMetadata: {
	// 		'preferred-frame-size': ['100%', '1200px'],
	// 	},
	// 	adapters: {
	// 		mcpApps: { enabled: true },
	// 	},
	// });

	server.resource(
		{
			name: PREVIEW_STORIES_RESOURCE_URI,
			description: 'App Resource for the Get Story tool',
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
						text: previewHtml,
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
			name: PREVIEW_STORIES_TOOL_NAME,
			title: 'Preview stories',
			description: `Use this tool to preview one or more stories, rendering them as an MCP App using the UI Resource or returning the raw URL for users to visit.`,
			schema: GetStoryUrlsInput,
			outputSchema: GetStoryUrlsOutput,
			enabled: () => server.ctx.custom?.toolsets?.dev ?? true,
			_meta: { ui: { resourceUri: PREVIEW_STORIES_RESOURCE_URI } },
		},
		async (input) => {
			try {
				const { origin, disableTelemetry } = server.ctx.custom ?? {};

				if (!origin) {
					throw new Error('Origin is required in addon context');
				}

				const index = await fetchStoryIndex(origin);
				const entriesList = Object.values(index.entries);

				const structuredResult: GetStoryUrlsOutput['stories'] = [];
				const textResult: string[] = [];

				for (const inputParams of input.stories) {
					const { exportName, explicitStoryName, absoluteStoryPath } =
						inputParams;
					const relativePath = `./${path.relative(process.cwd(), absoluteStoryPath)}`;

					logger.debug('Searching for:');
					logger.debug({
						exportName,
						explicitStoryName,
						absoluteStoryPath,
						relativePath,
					});

					const foundStory = entriesList.find(
						(entry) =>
							entry.importPath === relativePath &&
							[explicitStoryName, storyNameFromExport(exportName)].includes(
								entry.name,
							),
					);

					if (foundStory) {
						logger.debug(`Found story ID: ${foundStory.id}`);
						const previewUrl = `${origin}/?path=/story/${foundStory.id}`;
						structuredResult.push({
							title: foundStory.title,
							name: foundStory.name,
							previewUrl,
						});
						textResult.push(previewUrl);
					} else {
						logger.debug('No story found');
						let errorMessage = `No story found for export name "${exportName}" with absolute file path "${absoluteStoryPath}"`;
						if (!explicitStoryName) {
							errorMessage += ` (did you forget to pass the explicit story name?)`;
						}
						structuredResult.push({
							input: inputParams,
							error: errorMessage,
						});
						textResult.push(errorMessage);
					}
				}

				if (!disableTelemetry) {
					await collectTelemetry({
						event: 'tool:getStoryUrls',
						server,
						toolset: 'dev',
						inputStoryCount: input.stories.length,
						outputStoryCount: structuredResult.length,
					});
				}

				return {
					content: textResult.map((text) => ({
						type: 'text',
						text,
					})),
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
