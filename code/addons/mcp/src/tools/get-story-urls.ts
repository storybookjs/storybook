import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import { collectTelemetry } from '../telemetry.ts';
import { fetchStoryIndex } from '../utils/fetch-story-index.ts';
import { findStoryIds } from '../utils/find-story-ids.ts';
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
			enabled: () => server.ctx.custom?.toolsets?.dev ?? true,
		},
		async (input: GetStoryUrlsInput) => {
			try {
				const { origin, disableTelemetry } = server.ctx.custom ?? {};

				if (!origin) {
					throw new Error('Origin is required in addon context');
				}

				const index = await fetchStoryIndex(origin);
				const { found, notFound } = findStoryIds(index, input.stories);

				const result: string[] = [];

				for (const { id } of found) {
					result.push(`${origin}/?path=/story/${id}`);
				}

				for (const { errorMessage } of notFound) {
					result.push(errorMessage);
				}

				if (!disableTelemetry) {
					await collectTelemetry({
						event: 'tool:getStoryUrls',
						server,
						toolset: 'dev',
						inputStoryCount: input.stories.length,
						outputStoryCount: found.length,
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
