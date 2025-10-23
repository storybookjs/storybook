import type { McpServer } from 'tmcp';
import path from 'node:path';
import { storyNameFromExport } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/node-logger';
import * as v from 'valibot';
import { collectTelemetry } from '../telemetry.ts';
import { fetchStoryIndex } from '../utils/fetch-story-index.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonContext } from '../types.ts';
import { StoryInputArray } from '../types.ts';

export const GET_STORY_URLS_TOOL_NAME = 'get-story-urls';

const GetStoryUrlsInput = v.object({
	stories: StoryInputArray,
});

type GetStoryUrlsInput = v.InferOutput<typeof GetStoryUrlsInput>;

export async function addGetStoryUrlsTool(
	server: McpServer<any, AddonContext>,
) {
	server.tool(
		{
			name: GET_STORY_URLS_TOOL_NAME,
			title: "Get stories' URLs",
			description: `Get the URL for one or more stories.`,
			schema: GetStoryUrlsInput,
		},
		async (input: GetStoryUrlsInput) => {
			try {
				const { origin, disableTelemetry } = server.ctx.custom ?? {};

				if (!origin) {
					throw new Error('Origin is required in addon context');
				}

				const index = await fetchStoryIndex(origin);
				const entriesList = Object.values(index.entries);

				const result: string[] = [];
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
						logger.debug('Found story ID:', foundStoryId);
						result.push(`${origin}/?path=/story/${foundStoryId}`);
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
						inputStoryCount: input.stories.length,
						outputStoryCount: foundStoryCount,
					});
				}

				return {
					content: result.map((text) => ({
						type: 'text',
						text,
					})),
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
