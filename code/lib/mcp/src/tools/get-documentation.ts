import * as v from 'valibot';
import type { McpServer } from 'tmcp';
import type { ComponentManifest, Doc, StorybookContext } from '../types.ts';
import { StorybookIdField } from '../types.ts';
import { getManifests, errorToMCPContent } from '../utils/get-manifest.ts';
import { LIST_TOOL_NAME } from './list-all-documentation.ts';
import {
	formatComponentManifest,
	formatDocsManifest,
	MAX_STORIES_TO_SHOW,
} from '../utils/manifest-formatter/markdown.ts';
import { GET_STORY_TOOL_NAME } from './get-documentation-for-story.ts';

export const GET_TOOL_NAME = 'get-documentation';

const BaseInput = {
	id: v.pipe(v.string(), v.description('The component or docs entry ID (e.g., "button")')),
};

export async function addGetDocumentationTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
	options?: { multiSource?: boolean },
) {
	const schema = options?.multiSource
		? v.object({ ...BaseInput, ...StorybookIdField })
		: v.object(BaseInput);

	server.tool(
		{
			name: GET_TOOL_NAME,
			title: 'Get Documentation',
			description: `Get documentation for a UI component or docs entry.

Returns the first ${MAX_STORIES_TO_SHOW} stories (including story IDs) with code snippets showing how props are used, plus TypeScript prop definitions. Call this before using a component to avoid hallucinating prop names, types, or valid combinations. Stories reveal real prop usage patterns, interactions, and edge cases that type definitions alone don't show. If the example stories don't show the prop you need, use the ${GET_STORY_TOOL_NAME} tool to fetch the story documentation for the specific story variant you need.

Example: id="button" returns Primary, Secondary, Large stories with code like <Button variant="primary" size="large"> showing actual prop combinations.`,
			schema,
			enabled,
		},
		async (input: { id: string; storybookId?: string }) => {
			try {
				const ctx = server.ctx.custom;
				const { id, storybookId } = input;
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

				const { componentManifest, docsManifest } = await getManifests(
					ctx?.request,
					ctx?.manifestProvider,
					source,
				);

				const component = componentManifest.components[id];
				const docsEntry = docsManifest?.docs[id];

				if (!component && !docsEntry) {
					const suffix = storybookId ? ` in source "${storybookId}"` : '';
					await ctx?.onGetDocumentation?.({
						context: ctx,
						input,
					});

					return {
						content: [
							{
								type: 'text' as const,
								text: `Component or Docs Entry not found: "${id}"${suffix}. Use the ${LIST_TOOL_NAME} tool to see available components and documentation entries.`,
							},
						],
						isError: true,
					};
				}

				const documentation = component ?? docsEntry!;
				const text = component
					? formatComponentManifest(documentation as ComponentManifest)
					: formatDocsManifest(documentation as Doc);

				await ctx?.onGetDocumentation?.({
					context: ctx,
					input,
					foundDocumentation: documentation,
					resultText: text,
				});

				return {
					content: [
						{
							type: 'text' as const,
							text,
						},
					],
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
