import * as v from 'valibot';
import type { McpServer } from 'tmcp';
import type { ComponentManifest, Doc, StorybookContext } from '../types.ts';
import { StorybookIdField } from '../types.ts';
import {
	getManifests,
	errorToMCPContent,
	resolveComponentEntry,
	resolveDoc,
} from '../utils/get-manifest.ts';
import { LIST_TOOL_NAME } from './list-all-documentation.ts';
import {
	formatComponentManifest,
	formatDocsManifest,
	MAX_STORIES_TO_SHOW,
} from '../utils/manifest-formatter/markdown.ts';
import { GET_STORY_TOOL_NAME } from './get-documentation-for-story.ts';

export const GET_TOOL_NAME = 'get-documentation';

const BaseInput = {
	id: v.pipe(v.string(), v.description('The component or docs entry ID (e.g., "button")')),
};

export const GET_DOCUMENTATION_TOOL_DESCRIPTION = `Get documentation for a UI component or docs entry.

Returns the first ${MAX_STORIES_TO_SHOW} stories (including story IDs) with code snippets showing how props are used, plus TypeScript prop definitions. Call this before using a component to avoid hallucinating prop names, types, or valid combinations. Stories reveal real prop usage patterns, interactions, and edge cases that type definitions alone don't show. If the example stories don't show the prop you need, use the ${GET_STORY_TOOL_NAME} tool to fetch the story documentation for the specific story variant you need.

Example: id="button" returns Primary, Secondary, Large stories with code like <Button variant="primary" size="large"> showing actual prop combinations.`;

export function getDocumentationToolSchema(options?: { multiSource?: boolean }) {
	return options?.multiSource
		? v.object({ ...BaseInput, ...StorybookIdField })
		: v.object(BaseInput);
}

export function getDocumentationToolMetadata(options?: { multiSource?: boolean }) {
	return {
		name: GET_TOOL_NAME,
		title: 'Get Documentation',
		description: GET_DOCUMENTATION_TOOL_DESCRIPTION,
		schema: getDocumentationToolSchema(options),
	};
}

export async function addGetDocumentationTool(
	server: McpServer<any, StorybookContext>,
	enabled?: Parameters<McpServer<any, StorybookContext>['tool']>[0]['enabled'],
	options?: { multiSource?: boolean },
) {
	server.tool(
		{
			...getDocumentationToolMetadata(options),
			enabled,
		},
		async (input: { id: string; storybookId?: string }) => {
			try {
				const ctx = server.ctx.custom;
				const { id, storybookId } = input;
				const sources = ctx?.sources;
				const isMultiSource = sources && sources.some((s) => s.url);

				// In multi-source mode, validate and resolve the source
				let source;
				if (isMultiSource) {
					if (!storybookId) {
						const availableSources = sources.map((s) => s.id).join(', ');
						return {
							content: [
								{
									type: 'text' as const,
									text: `storybookId is required. Available sources: ${availableSources}. Use the ${LIST_TOOL_NAME} tool to see available sources.`,
								},
							],
							isError: true,
						};
					}

					source = sources.find((s) => s.id === storybookId);
					if (!source) {
						const availableSources = sources.map((s) => s.id).join(', ');
						return {
							content: [
								{
									type: 'text' as const,
									text: `Storybook source not found: "${storybookId}". Available sources: ${availableSources}. Use the ${LIST_TOOL_NAME} tool to see available sources.`,
								},
							],
							isError: true,
						};
					}
				}

				let component: ComponentManifest | undefined;
				let docsEntry: Doc | undefined;

				// Dev (experimentalDocgenServer): resolve a single entry in-process, bypassing
				// the all-component manifest index so one lookup never triggers all-docgen.
				// The in-process services back the local Storybook only, so this is used for the
				// local source — single-source (no `source`) or the urlless `local` source in a
				// composition. Remote sources (with a `url`) fall through to the fetch path.
				if (ctx?.resolveEntry && !source?.url) {
					const resolved = await ctx.resolveEntry(id, source);
					if (resolved?.kind === 'component') {
						component = resolved.component;
					} else if (resolved?.kind === 'doc') {
						docsEntry = resolved.doc;
					}
				} else {
					const { componentManifest, docsManifest } = await getManifests(
						ctx?.request,
						ctx?.manifestProvider,
						source,
					);

					const componentEntry = componentManifest.components[id];
					const docEntry = docsManifest?.docs[id];

					// Built/static/remote. v1 (split/ref) index rows carry `$ref`s to externalized
					// payloads, which these helpers follow; v0 (inline) rows have no `$ref`s and are
					// returned unchanged. Either way the result is a fully-resolved entry.
					if (componentEntry) {
						component = await resolveComponentEntry(
							componentEntry,
							ctx?.request,
							ctx?.manifestProvider,
							source,
						);
					} else if (docEntry) {
						docsEntry = await resolveDoc(docEntry, ctx?.request, ctx?.manifestProvider, source);
					}
				}

				if (!component && !docsEntry) {
					const suffix = storybookId ? ` in source "${storybookId}"` : '';
					await ctx?.onGetDocumentation?.({
						context: ctx,
						input,
					});

					return {
						content: [
							{
								type: 'text' as const,
								text: `Component or Docs Entry not found: "${id}"${suffix}. Use the ${LIST_TOOL_NAME} tool to see available components and documentation entries.`,
							},
						],
						isError: true,
					};
				}

				const documentation = component ?? docsEntry!;
				const text = component
					? formatComponentManifest(documentation as ComponentManifest)
					: formatDocsManifest(documentation as Doc);

				await ctx?.onGetDocumentation?.({
					context: ctx,
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
