import type { McpServer } from 'tmcp';
import type { StorybookContext } from '../types.ts';
import { fetchManifest, errorToMCPContent } from '../utils/fetch-manifest.ts';
import { formatComponentManifestMapToList } from '../utils/format-manifest.ts';

export const LIST_TOOL_NAME = 'list-all-components';

export async function addListAllComponentsTool(
	server: McpServer<any, StorybookContext>,
) {
	server.tool(
		{
			name: LIST_TOOL_NAME,
			title: 'List All Components',
			description:
				'List all available UI components from the component library',
		},
		async () => {
			try {
				const manifest = await fetchManifest(
					server.ctx.custom?.source,
					server.ctx.custom?.manifestProvider,
				);

				const componentList = formatComponentManifestMapToList(manifest);
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
