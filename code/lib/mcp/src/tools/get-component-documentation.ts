import * as v from 'valibot';
import type { McpServer } from 'tmcp';
import type { StorybookContext, ComponentManifest } from '../types.ts';
import { getManifest, errorToMCPContent } from '../utils/get-manifest.ts';
import { formatComponentManifest } from '../utils/format-manifest.ts';

export const GET_TOOL_NAME = 'get-component-documentation';

const GetComponentDocumentationInput = v.object({
	componentIds: v.pipe(
		v.array(v.string()),
		v.minLength(1, 'At least one component ID is required'),
	),
});

type GetComponentDocumentationInput = v.InferOutput<
	typeof GetComponentDocumentationInput
>;

export async function addGetComponentDocumentationTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
) {
	server.tool(
		{
			name: GET_TOOL_NAME,
			title: 'Get Documentation for Components',
			description: 'Get detailed documentation for specific UI components',
			schema: GetComponentDocumentationInput,
			enabled,
		},
		async (input: GetComponentDocumentationInput) => {
			try {
				const manifest = await getManifest(
					server.ctx.custom?.source,
					server.ctx.custom?.manifestProvider,
				);

				const content = [];
				const notFoundIds: string[] = [];
				const foundComponents: ComponentManifest[] = [];

				for (const componentId of input.componentIds) {
					const component = manifest.components[componentId];

					if (!component) {
						notFoundIds.push(componentId);
						continue;
					}

					foundComponents.push(component);
					content.push({
						type: 'text' as const,
						text: formatComponentManifest(component),
					});
				}

				const allNotFound = notFoundIds.length === input.componentIds.length;
				if (notFoundIds.length > 0) {
					const componentWord =
						notFoundIds.length > 1 ? 'Components' : 'Component';
					const severity = allNotFound ? 'Error' : 'Warning';
					content.push({
						type: 'text' as const,
						text: `${severity}: ${componentWord} not found: ${notFoundIds.join(', ')}`,
					});
				}

				await server.ctx.custom?.onGetComponentDocumentation?.({
					context: server.ctx.custom,
					input: { componentIds: input.componentIds },
					foundComponents,
					notFoundIds,
				});

				return {
					content,
					...(allNotFound && { isError: true }),
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
