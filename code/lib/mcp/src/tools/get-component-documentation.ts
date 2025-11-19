import * as v from 'valibot';
import type { McpServer } from 'tmcp';
import type { StorybookContext } from '../types.ts';
import { getManifest, errorToMCPContent } from '../utils/get-manifest.ts';
import { formatComponentManifest } from '../utils/format-manifest.ts';

export const GET_TOOL_NAME = 'get-component-documentation';

const GetComponentDocumentationInput = v.object({
	componentId: v.string(),
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
			title: 'Get Documentation for Component',
			description: 'Get detailed documentation for a specific UI component',
			schema: GetComponentDocumentationInput,
			enabled,
		},
		async (input: GetComponentDocumentationInput) => {
			try {
				const manifest = await getManifest(
					server.ctx.custom?.request,
					server.ctx.custom?.manifestProvider,
				);

				const component = manifest.components[input.componentId];

				if (!component) {
					await server.ctx.custom?.onGetComponentDocumentation?.({
						context: server.ctx.custom,
						input: { componentId: input.componentId },
					});

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

				await server.ctx.custom?.onGetComponentDocumentation?.({
					context: server.ctx.custom,
					input: { componentId: input.componentId },
					foundComponent: component,
				});

				return {
					content: [
						{
							type: 'text' as const,
							text: formatComponentManifest(component),
						},
					],
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
