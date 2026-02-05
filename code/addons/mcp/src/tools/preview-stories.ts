import type { McpServer } from 'tmcp';
import path from 'node:path';
import url from 'node:url';
import { storyNameFromExport } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/node-logger';
import * as v from 'valibot';
import { collectTelemetry } from '../telemetry.ts';
import { buildArgsParam } from '../utils/build-args-param.ts';
import { fetchStoryIndex } from '../utils/fetch-story-index.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonContext } from '../types.ts';
import { StoryInput, StoryInputArray } from '../types.ts';
import appTemplate from './preview-stories/preview-stories-app-template.html';
import fs from 'node:fs/promises';
import { slash } from '../utils/slash.ts';
import { PREVIEW_STORIES_TOOL_NAME } from './tool-names.ts';

export const PREVIEW_STORIES_RESOURCE_URI = `ui://${PREVIEW_STORIES_TOOL_NAME}/preview.html`;

const PreviewStoriesInput = v.object({
	stories: StoryInputArray,
});

const PreviewStoriesOutput = v.object({
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

type PreviewStoriesInput = v.InferOutput<typeof PreviewStoriesInput>;
export type PreviewStoriesOutput = v.InferOutput<typeof PreviewStoriesOutput>;

export async function addPreviewStoriesTool(server: McpServer<any, AddonContext>) {
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
			//@ts-expect-error tmcp types doesn't know this is valid
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
			name: PREVIEW_STORIES_TOOL_NAME,
			title: 'Preview stories',
			description: `Use this tool to preview one or more stories, rendering them as an MCP App using the UI Resource or returning the raw URL for users to visit.`,
			schema: PreviewStoriesInput,
			outputSchema: PreviewStoriesOutput,
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

				const structuredResult: PreviewStoriesOutput['stories'] = [];
				const textResult: string[] = [];

				for (const inputParams of input.stories) {
					const { exportName, explicitStoryName, absoluteStoryPath } = inputParams;

					const normalizedCwd = slash(process.cwd());
					const normalizedAbsolutePath = slash(absoluteStoryPath);
					const relativePath = `./${path.posix.relative(normalizedCwd, normalizedAbsolutePath)}`;

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
							[explicitStoryName, storyNameFromExport(exportName)].includes(entry.name),
					);

					if (foundStory) {
						logger.debug(`Found story ID: ${foundStory.id}`);
						let previewUrl = `${origin}/?path=/story/${foundStory.id}`;

						// Add props as args query param if provided
						const argsParam = buildArgsParam(inputParams.props ?? {});
						if (argsParam) {
							previewUrl += `&args=${argsParam}`;
						}

						// Add globals query param if provided
						const globalsParam = buildArgsParam(inputParams.globals ?? {});
						if (globalsParam) {
							previewUrl += `&globals=${globalsParam}`;
						}

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
						event: 'tool:previewStories',
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
