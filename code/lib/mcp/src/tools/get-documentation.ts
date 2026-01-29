import * as v from 'valibot';
import type { McpServer } from 'tmcp';
import type { ComponentManifest, Doc, StorybookContext } from '../types.ts';
import { getManifests, errorToMCPContent } from '../utils/get-manifest.ts';
import { formatComponentManifest, formatDocsManifest } from '../utils/format-manifest.ts';
import { LIST_TOOL_NAME } from './list-all-documentation.ts';
import { MAX_STORIES_TO_SHOW } from '../utils/manifest-formatter/types.ts';
import { GET_STORY_TOOL_NAME } from './get-documentation-for-story.ts';

export const GET_TOOL_NAME = 'get-documentation';

const GetDocumentationInput = v.object({
	id: v.string(),
});

export async function addGetDocumentationTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
) {
	server.tool(
		{
			name: GET_TOOL_NAME,
			title: 'Get Documentation',
			description: `Get documentation for a UI component or docs entry.

Returns the first ${MAX_STORIES_TO_SHOW} stories with code snippets showing how props are used, plus TypeScript prop definitions. Call this before using a component to avoid hallucinating prop names, types, or valid combinations. Stories reveal real prop usage patterns, interactions, and edge cases that type definitions alone don't show. If the example stories don't show the prop you need, use the ${GET_STORY_TOOL_NAME} tool to fetch the story documentation for the specific story variant you need.

Example: id="button" returns Primary, Secondary, Large stories with code like <Button variant="primary" size="large"> showing actual prop combinations.`,
			schema: GetDocumentationInput,
			enabled,
		},
		async (input: v.InferOutput<typeof GetDocumentationInput>) => {
			try {
				const { componentManifest, docsManifest } = await getManifests(
					server.ctx.custom?.request,
					server.ctx.custom?.manifestProvider,
				);

				const component = componentManifest.components[input.id];
				const docsEntry = docsManifest?.docs[input.id];

				if (!component && !docsEntry) {
					await server.ctx.custom?.onGetDocumentation?.({
						context: server.ctx.custom,
						input,
					});

					return {
						content: [
							{
								type: 'text' as const,
								text: `Component or Docs Entry not found: "${input.id}". Use the ${LIST_TOOL_NAME} tool to see available components and documentation entries.`,
							},
						],
						isError: true,
					};
				}

				const documentation = component ?? docsEntry!;

				const format = server.ctx.custom?.format ?? 'markdown';
				const text = component
					? formatComponentManifest(documentation as ComponentManifest, format)
					: formatDocsManifest(documentation as Doc, format);

				await server.ctx.custom?.onGetDocumentation?.({
					context: server.ctx.custom,
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
