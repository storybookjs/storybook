import type { McpServer } from 'tmcp';
import type { StorybookContext } from '../types.ts';
import { getManifests, errorToMCPContent } from '../utils/get-manifest.ts';
import { formatManifestsToLists } from '../utils/format-manifest.ts';

export const LIST_TOOL_NAME = 'list-all-documentation';

export async function addListAllDocumentationTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
) {
	server.tool(
		{
			name: LIST_TOOL_NAME,
			title: 'List All Documentation',
			description:
				'List all available UI components and documentation entries from the Storybook',
			enabled,
		},
		async () => {
			try {
				const manifests = await getManifests(
					server.ctx.custom?.request,
					server.ctx.custom?.manifestProvider,
				);

				const format = server.ctx.custom?.format ?? 'markdown';
				const lists = formatManifestsToLists(manifests, format);

				await server.ctx.custom?.onListAllDocumentation?.({
					context: server.ctx.custom,
					manifests,
				});

				return {
					content: [
						{
							type: 'text',
							text: lists,
						},
					],
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
