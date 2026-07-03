import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import type { ComponentManifestEntry, StorybookContext } from '../types.ts';
import {
	getManifests,
	getMultiSourceManifests,
	errorToMCPContent,
	resolveComponentStories,
} from '../utils/get-manifest.ts';
import { mapWithConcurrency } from '../utils/map-with-concurrency.ts';
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
		description:
			'List all available UI components and documentation entries from the Storybook. Call this first — before reading component source — whenever a task involves design-system components or a question about their props, API, or usage, then fetch the relevant entries with get-documentation.',
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

					// Like single-source mode, split/ref (v1) sources keep stories behind a
					// `$ref`; resolve them per source so story sub-bullets render. Failures
					// are isolated to a source so one bad source can't break the whole list.
					if (withStoryIds) {
						await Promise.all(
							multiSourceManifests.map(async (sourceManifest) => {
								if (sourceManifest.error || sourceManifest.notice) return;
								try {
									const components: Record<string, ComponentManifestEntry> =
										sourceManifest.componentManifest.components;
									const entries = Object.entries(components);
									const resolved = await mapWithConcurrency(
										entries,
										16,
										async ([id, component]) => {
											const storiesResolved = await resolveComponentStories(
												component,
												ctx.request,
												ctx.manifestProvider,
												sourceManifest.source,
											);
											return [id, storiesResolved] as const;
										},
									);
									for (const [id, component] of resolved) {
										components[id] = component;
									}
								} catch {
									// Leave this source's rows unresolved rather than failing the listing.
								}
							}),
						);
					}

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
					const entries = Object.entries(components);
					const resolved = await mapWithConcurrency(entries, 16, async ([id, component]) => {
						const storiesResolved = await resolveComponentStories(
							component,
							ctx?.request,
							ctx?.manifestProvider,
						);
						return [id, storiesResolved] as const;
					});
					for (const [id, component] of resolved) {
						components[id] = component;
					}
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
