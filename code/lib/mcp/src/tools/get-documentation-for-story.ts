import * as v from 'valibot';
import type { McpServer } from 'tmcp';
import type { StorybookContext } from '../types.ts';
import { errorToMCPContent, getManifests } from '../utils/get-manifest.ts';
import { formatStoryDocumentation } from '../utils/format-manifest.ts';

export const GET_STORY_TOOL_NAME = 'get-documentation-for-story';

const GetComponentStoryDocumentationInput = v.object({
	componentId: v.string(),
	storyName: v.string(),
});

type GetComponentStoryDocumentationInput = v.InferOutput<
	typeof GetComponentStoryDocumentationInput
>;

export async function addGetComponentStoryDocumentationTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
) {
	server.tool(
		{
			name: GET_STORY_TOOL_NAME,
			title: 'Get Documentation for Component Story',
			description:
				'Get detailed documentation for a specific story variant of a UI component. Use this when you need to see the implementation of a specific story.',
			schema: GetComponentStoryDocumentationInput,
			enabled,
		},
		async (input: GetComponentStoryDocumentationInput) => {
			try {
				const manifest = await getManifests(
					server.ctx.custom?.request,
					server.ctx.custom?.manifestProvider,
				);

				const component =
					manifest.componentManifest.components[input.componentId];

				if (!component) {
					return {
						content: [
							{
								type: 'text' as const,
								text: `Component not found: "${input.componentId}". Use the list-all-components tool to see available components.`,
							},
						],
						isError: true,
					};
				}

				const story = component.stories?.find(
					(s) => s.name === input.storyName,
				);

				if (!story) {
					const availableStories =
						component.stories?.map((s) => s.name).join(', ') ?? 'none';
					return {
						content: [
							{
								type: 'text' as const,
								text: `Story "${input.storyName}" not found for component "${input.componentId}". Available stories: ${availableStories}`,
							},
						],
						isError: true,
					};
				}

				const format = server.ctx.custom?.format ?? 'markdown';
				return {
					content: [
						{
							type: 'text' as const,
							text: formatStoryDocumentation(
								component,
								input.storyName,
								format,
							),
						},
					],
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
