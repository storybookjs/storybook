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
import { StoryInputArray } from '../types.ts';
import previewHtml from './preview.html';

export const GET_STORY_URLS_TOOL_NAME = 'preview-story';
export const GET_STORY_URLS_RESOURCE_URI = `ui://${GET_STORY_URLS_TOOL_NAME}/preview.html`;

const GetStoryUrlsInput = v.object({
	stories: StoryInputArray,
});

type GetStoryUrlsInput = v.InferOutput<typeof GetStoryUrlsInput>;

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
			name: GET_STORY_URLS_RESOURCE_URI,
			description: 'App Resource for the Get Story tool',
			uri: GET_STORY_URLS_RESOURCE_URI,
			mimeType: 'text/html;profile=mcp-app',
		},
		() => ({
			contents: [
				{
					uri: GET_STORY_URLS_RESOURCE_URI,
					mimeType: 'text/html;profile=mcp-app',
					text: previewHtml,
					_meta: {
						ui: {
							prefersBorders: true,
							csp: {
								frameDomains: ['http://localhost:6006'],
							},
						},
					},
				},
			],
		}),
	);

	server.tool(
		{
			name: GET_STORY_URLS_TOOL_NAME,
			title: 'Preview stories, either as rendered MCP Apps or raw URLs',
			description: `Preview one or more stories, rendering them as an MCP App using the UI Resource.`,
			schema: GetStoryUrlsInput,
			enabled: () => server.ctx.custom?.toolsets?.dev ?? true,
			_meta: { ui: { resourceUri: GET_STORY_URLS_RESOURCE_URI } },
		},
		async (input) => {
			try {
				const { origin, disableTelemetry } = server.ctx.custom ?? {};

				if (!origin) {
					throw new Error('Origin is required in addon context');
				}

				const index = await fetchStoryIndex(origin);
				const entriesList = Object.values(index.entries);

				const result: string[] = [];
				const previewUrls: string[] = [];
				let foundStoryCount = 0;

				for (const {
					exportName,
					explicitStoryName,
					absoluteStoryPath,
				} of input.stories) {
					const relativePath = `./${path.relative(process.cwd(), absoluteStoryPath)}`;

					logger.debug('Searching for:');
					logger.debug({
						exportName,
						explicitStoryName,
						absoluteStoryPath,
						relativePath,
					});

					const foundStoryId = entriesList.find(
						(entry) =>
							entry.importPath === relativePath &&
							[explicitStoryName, storyNameFromExport(exportName)].includes(
								entry.name,
							),
					)?.id;

					if (foundStoryId) {
						logger.debug(`Found story ID: ${foundStoryId}`);
						result.push(`${origin}/?path=/story/${foundStoryId}`);
						previewUrls.push(`${origin}/iframe.html?id=${foundStoryId}`);
						foundStoryCount++;
					} else {
						logger.debug('No story found');
						let errorMessage = `No story found for export name "${exportName}" with absolute file path "${absoluteStoryPath}"`;
						if (!explicitStoryName) {
							errorMessage += ` (did you forget to pass the explicit story name?)`;
						}
						result.push(errorMessage);
					}
				}

				if (!disableTelemetry) {
					await collectTelemetry({
						event: 'tool:getStoryUrls',
						server,
						toolset: 'dev',
						inputStoryCount: input.stories.length,
						outputStoryCount: foundStoryCount,
					});
				}

				return {
					content: result.map((text) => ({
						type: 'text',
						text,
					})),
					structuredContent: {
						previewUrls,
					},
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
