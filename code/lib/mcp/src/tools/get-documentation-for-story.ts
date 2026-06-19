import * as v from 'valibot';
import type { McpServer } from 'tmcp';
import type { StorybookContext } from '../types.ts';
import { StorybookIdField } from '../types.ts';
import { errorToMCPContent, getManifests, resolveComponentDocgen } from '../utils/get-manifest.ts';
import { formatStoryDocumentation } from '../utils/manifest-formatter/markdown.ts';
import { LIST_TOOL_NAME } from './list-all-documentation.ts';

export const GET_STORY_TOOL_NAME = 'get-documentation-for-story';

export const GET_STORY_DOCUMENTATION_TOOL_DESCRIPTION =
	'Get detailed documentation for a specific story variant of a UI component. Use this when you need to see more usage examples of a component, via the stories written for it.';

const BaseInput = {
	componentId: v.string(),
	storyName: v.string(),
};

export function getStoryDocumentationToolSchema(options?: { multiSource?: boolean }) {
	return options?.multiSource
		? v.object({ ...BaseInput, ...StorybookIdField })
		: v.object(BaseInput);
}

export function getStoryDocumentationToolMetadata(options?: { multiSource?: boolean }) {
	return {
		name: GET_STORY_TOOL_NAME,
		title: 'Get Documentation for Story',
		description: GET_STORY_DOCUMENTATION_TOOL_DESCRIPTION,
		schema: getStoryDocumentationToolSchema(options),
	};
}

export async function addGetStoryDocumentationTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
	options?: { multiSource?: boolean },
) {
	server.tool(
		{
			...getStoryDocumentationToolMetadata(options),
			enabled,
		},
		async (input: { componentId: string; storyName: string; storybookId?: string }) => {
			try {
				const ctx = server.ctx.custom;
				const { componentId, storyName, storybookId } = input;
				const sources = ctx?.sources;
				const isMultiSource = sources && sources.some((s) => s.url);

				// In multi-source mode, validate and resolve the source
				let source;
				if (isMultiSource) {
					if (!storybookId) {
						const availableSources = sources.map((s) => s.id).join(', ');
						return {
							content: [
								{
									type: 'text' as const,
									text: `storybookId is required. Available sources: ${availableSources}. Use the ${LIST_TOOL_NAME} tool to see available sources.`,
								},
							],
							isError: true,
						};
					}

					source = sources.find((s) => s.id === storybookId);
					if (!source) {
						const availableSources = sources.map((s) => s.id).join(', ');
						return {
							content: [
								{
									type: 'text' as const,
									text: `Storybook source not found: "${storybookId}". Available sources: ${availableSources}. Use the ${LIST_TOOL_NAME} tool to see available sources.`,
								},
							],
							isError: true,
						};
					}
				}

				const manifest = await getManifests(ctx?.request, ctx?.manifestProvider, source);

				let component = manifest.componentManifest?.components[componentId];

				if (!component) {
					return {
						content: [
							{
								type: 'text' as const,
								text: `Component not found: "${componentId}". Use the list-all-documentation tool to see available components.`,
							},
						],
						isError: true,
					};
				}

				// Externalized-docgen manifests carry only a stub here; fetch the full data.
				if (component.docgen?.$ref) {
					component = await resolveComponentDocgen(
						component,
						ctx?.request,
						ctx?.manifestProvider,
						source,
					);
				}

				const story = component.stories?.find((s) => s.name === storyName);

				if (!story) {
					const availableStories = component.stories?.map((s) => s.name).join(', ') ?? 'none';
					return {
						content: [
							{
								type: 'text' as const,
								text: `Story "${storyName}" not found for component "${componentId}". Available stories: ${availableStories}`,
							},
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: 'text' as const,
							text: formatStoryDocumentation(component, storyName),
						},
					],
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
