import * as v from 'valibot';
import type { McpServer } from 'tmcp';
import type { StorybookContext } from '../types.ts';
import { StorybookIdField } from '../types.ts';
import { errorToMCPContent, getManifests, resolveComponentEntry } from '../utils/get-manifest.ts';
import type { ComponentManifest } from '../types.ts';
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

				let component: ComponentManifest | undefined;

				// Dev (experimentalDocgenServer): resolve a single entry in-process, bypassing
				// the all-component manifest index so one lookup never triggers all-docgen.
				// The in-process services back the local Storybook only, so this is used for the
				// local source — single-source (no `source`) or the urlless `local` source in a
				// composition. Remote sources (with a `url`) fall through to the fetch path.
				if (ctx?.resolveEntry && !source?.url) {
					const resolved = await ctx.resolveEntry(componentId, source);
					if (resolved?.kind === 'component') {
						component = resolved.component;
					}
				} else {
					const manifest = await getManifests(ctx?.request, ctx?.manifestProvider, source);
					const componentEntry = manifest.componentManifest?.components[componentId];

					// Built/static/remote. v1 (split/ref) index rows carry `$ref`s to externalized
					// payloads, which these helpers follow; v0 (inline) rows have no `$ref`s and are
					// returned unchanged. Either way the result is a fully-resolved entry.
					if (componentEntry) {
						component = await resolveComponentEntry(
							componentEntry,
							ctx?.request,
							ctx?.manifestProvider,
							source,
						);
					}
				}

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

				const story = Array.isArray(component.stories)
					? component.stories.find((s) => s.name === storyName)
					: undefined;

				if (!story) {
					const availableStories = Array.isArray(component.stories)
						? component.stories.map((s) => s.name).join(', ')
						: 'none';
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
