import type { McpServer } from 'tmcp';
import type { StorybookContext } from '../types.ts';
import { getManifest, errorToMCPContent } from '../utils/get-manifest.ts';
import { formatComponentManifestMapToList } from '../utils/format-manifest.ts';

export const LIST_TOOL_NAME = 'list-all-components';

export async function addListAllComponentsTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
) {
	server.tool(
		{
			name: LIST_TOOL_NAME,
			title: 'List All Components',
			description:
				'List all available UI components from the component library',
			enabled,
		},
		async () => {
			try {
				const manifest = await getManifest(
					server.ctx.custom?.source,
					server.ctx.custom?.manifestProvider,
				);

				const componentList = formatComponentManifestMapToList(manifest);

				await server.ctx.custom?.onListAllComponents?.({
					context: server.ctx.custom,
					manifest,
				});

				return {
					content: [
						{
							type: 'text',
							text: componentList,
						},
					],
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
