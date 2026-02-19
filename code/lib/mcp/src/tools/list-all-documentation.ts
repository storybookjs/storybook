import type { McpServer } from 'tmcp';
import type { StorybookContext } from '../types.ts';
import { getManifests, getMultiSourceManifests, errorToMCPContent } from '../utils/get-manifest.ts';
import { markdownFormatter } from '../utils/manifest-formatter/markdown.ts';

export const LIST_TOOL_NAME = 'list-all-documentation';

export async function addListAllDocumentationTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
) {
	server.tool(
		{
			name: LIST_TOOL_NAME,
			title: 'List All Documentation',
			description: 'List all available UI components and documentation entries from the Storybook',
			enabled,
		},
		async () => {
			try {
				const ctx = server.ctx.custom;

				// Multi-source mode: when sources are configured
				if (ctx?.sources?.some((s) => s.url)) {
					const multiSourceManifests = await getMultiSourceManifests(
						ctx.sources,
						ctx.request,
						ctx.manifestProvider,
					);

					const lists = markdownFormatter.formatMultiSourceManifestsToLists(multiSourceManifests);

					const firstSuccess = multiSourceManifests.find((m) => !m.error);
					if (firstSuccess) {
						await ctx.onListAllDocumentation?.({
							context: ctx,
							manifests: {
								componentManifest: firstSuccess.componentManifest,
								docsManifest: firstSuccess.docsManifest,
							},
							resultText: lists,
							sources: multiSourceManifests,
						});
					}

					return {
						content: [
							{
								type: 'text',
								text: lists,
							},
						],
					};
				}

				// Single-source mode: existing behavior
				const manifests = await getManifests(ctx?.request, ctx?.manifestProvider);

				const lists = markdownFormatter.formatManifestsToLists(manifests);

				await ctx?.onListAllDocumentation?.({
					context: ctx,
					manifests,
					resultText: lists,
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
