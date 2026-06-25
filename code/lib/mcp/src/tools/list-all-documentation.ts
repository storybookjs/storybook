import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import type { ComponentManifestEntry, StorybookContext } from '../types.ts';
import {
	getManifests,
	getMultiSourceManifests,
	errorToMCPContent,
	resolveComponentStories,
} from '../utils/get-manifest.ts';
import {
	formatMultiSourceManifestsToLists,
	formatManifestsToLists,
} from '../utils/manifest-formatter/markdown.ts';

export const LIST_TOOL_NAME = 'list-all-documentation';

export const ListAllDocumentationInput = v.object({
	withStoryIds: v.optional(
		v.pipe(
			v.boolean(),
			v.description(
				'When true, includes story sub-bullets under each component with story name and story ID. Use this to discover IDs for downstream story-focused workflows without filesystem lookup.',
			),
		),
		false,
	),
});

export function getListAllDocumentationToolMetadata() {
	return {
		name: LIST_TOOL_NAME,
		title: 'List All Documentation',
		description: 'List all available UI components and documentation entries from the Storybook',
		schema: ListAllDocumentationInput,
	};
}

export async function addListAllDocumentationTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
) {
	server.tool(
		{
			...getListAllDocumentationToolMetadata(),
			enabled,
		},
		async (input) => {
			try {
				const ctx = server.ctx.custom;
				const withStoryIds = input.withStoryIds ?? false;

				// Multi-source mode: when sources are configured
				if (ctx?.sources?.some((s) => s.url)) {
					const multiSourceManifests = await getMultiSourceManifests(
						ctx.sources,
						ctx.request,
						ctx.manifestProvider,
					);

					const lists = formatMultiSourceManifestsToLists(multiSourceManifests, {
						withStoryIds,
					});

					const firstSuccess = multiSourceManifests.find((m) => !m.error && !m.notice);
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

				// Split/ref format keeps stories behind a `$ref`; resolve them only when story
				// ids are requested so plain listing stays cheap.
				if (withStoryIds) {
					// Widened so resolved (inline) components can be written back regardless of the
					// parsed map's version. Resolution mutates the entries in place for formatting.
					const components: Record<string, ComponentManifestEntry> =
						manifests.componentManifest.components;
					await Promise.all(
						Object.entries(components).map(async ([id, component]) => {
							components[id] = await resolveComponentStories(
								component,
								ctx?.request,
								ctx?.manifestProvider,
							);
						}),
					);
				}

				const lists = formatManifestsToLists(manifests, {
					withStoryIds,
				});

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
