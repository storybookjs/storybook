import * as v from 'valibot';
import type { McpServer } from 'tmcp';
import type { ComponentManifest, Doc, StorybookContext } from '../types.ts';
import { getManifests, errorToMCPContent } from '../utils/get-manifest.ts';
import {
	formatComponentManifest,
	formatDocsManifest,
} from '../utils/format-manifest.ts';
import { LIST_TOOL_NAME } from './list-all-documentation.ts';

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
			description:
				'Get detailed documentation for a specific UI component or docs entry',
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
