import type { McpServer } from 'tmcp';
import type { Options } from 'storybook/internal/types';
import { logger } from 'storybook/internal/node-logger';
import {
	addGetDocumentationTool,
	addGetStoryDocumentationTool,
	addListAllDocumentationTool,
	GET_STORY_TOOL_NAME,
	GET_TOOL_NAME,
	getDocumentationToolMetadata,
	getListAllDocumentationToolMetadata,
	getStoryDocumentationToolMetadata,
	LIST_TOOL_NAME,
} from '@storybook/mcp';
import type { AddonContext } from '../types.ts';
import type { ToolAvailability } from '../utils/get-tool-availability.ts';
import { getDisplayReviewToolMetadata, addDisplayReviewTool } from './display-review.ts';
import { getChangedStoriesToolMetadata, addGetChangedStoriesTool } from './get-changed-stories.ts';
import {
	getStoriesByComponentToolMetadata,
	addGetStoriesByComponentTool,
} from './get-stories-by-component.ts';
import {
	buildStorybookStoryInstructions,
	getStorybookStoryInstructionsToolMetadata,
	addGetUIBuildingInstructionsTool,
} from './get-storybook-story-instructions.ts';
import { getPreviewStoriesToolMetadata, addPreviewStoriesTool } from './preview-stories.ts';
import { getRunStoryTestsToolMetadata, addRunStoryTestsTool } from './run-story-tests.ts';
import {
	DISPLAY_REVIEW_TOOL_NAME,
	GET_CHANGED_STORIES_TOOL_NAME,
	GET_STORIES_BY_COMPONENT_TOOL_NAME,
	GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
	PREVIEW_STORIES_TOOL_NAME,
	RUN_STORY_TESTS_TOOL_NAME,
} from './tool-names.ts';

export type ToolMetadata = {
	name: string;
	title?: string;
	description?: string;
	schema?: unknown;
	outputSchema?: unknown;
	_meta?: Record<string, unknown>;
};

export type StorybookAiToolCallResult = {
	content: Array<{ type: 'text'; text: string }>;
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
};

export type StorybookAiLocalTool = {
	call: (input?: Record<string, unknown>) => Promise<StorybookAiToolCallResult>;
};

export type AddonToolRegistryContext = {
	availability: ToolAvailability;
	multiSource?: boolean;
	toolsets?: AddonContext['toolsets'];
	options?: Options;
};

type AddonToolset = keyof NonNullable<AddonContext['toolsets']>;
type ToolEnabled = Parameters<McpServer<any, AddonContext>['tool']>[0]['enabled'];

type AddonToolDefinition = {
	name: string;
	toolset: AddonToolset;
	available?: (context: AddonToolRegistryContext) => boolean;
	getMetadata: (context: AddonToolRegistryContext) => ToolMetadata;
	register: (
		server: McpServer<any, AddonContext>,
		context: AddonToolRegistryContext,
		enabled: ToolEnabled,
	) => Promise<void>;
	getLocalTool?: (context: AddonToolRegistryContext & { options: Options }) => StorybookAiLocalTool;
};

const isToolsetEnabled = (toolset: AddonToolset, toolsets: AddonContext['toolsets'] | undefined) =>
	toolsets?.[toolset] ?? true;

const isToolAvailable = (definition: AddonToolDefinition, context: AddonToolRegistryContext) =>
	definition.available?.(context) ?? true;

const isMetadataToolEnabled = (
	definition: AddonToolDefinition,
	context: AddonToolRegistryContext,
) => isToolsetEnabled(definition.toolset, context.toolsets) && isToolAvailable(definition, context);

const createToolsetEnabled =
	(server: McpServer<any, AddonContext>, toolset: AddonToolset): ToolEnabled =>
	() =>
		server.ctx.custom?.toolsets?.[toolset] ?? true;

const addonToolDefinitions: AddonToolDefinition[] = [
	{
		name: PREVIEW_STORIES_TOOL_NAME,
		toolset: 'dev',
		getMetadata: () => getPreviewStoriesToolMetadata(),
		register: (server, _context, enabled) => addPreviewStoriesTool(server, enabled),
	},
	{
		name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
		toolset: 'dev',
		getMetadata: ({ availability, toolsets }) => {
			const testToolsetAvailable = isToolsetEnabled('test', toolsets) && availability.testSupported;
			return getStorybookStoryInstructionsToolMetadata({
				testToolsetAvailable,
				a11yAvailable: testToolsetAvailable && availability.a11yEnabled,
			});
		},
		register: (server, _context, enabled) => addGetUIBuildingInstructionsTool(server, enabled),
		getLocalTool: ({ availability, toolsets, options }) => ({
			call: async () => {
				const text = await buildStorybookStoryInstructions(options, {
					toolsets,
					a11yEnabled: availability.a11yEnabled,
					addonVitestAvailable: availability.testSupported,
				});
				return { content: [{ type: 'text', text }] };
			},
		}),
	},
	{
		name: GET_CHANGED_STORIES_TOOL_NAME,
		toolset: 'dev',
		available: ({ availability }) => availability.changeDetectionEnabled,
		getMetadata: () => getChangedStoriesToolMetadata(),
		register: (server, _context, enabled) => addGetChangedStoriesTool(server, enabled),
	},
	{
		name: GET_STORIES_BY_COMPONENT_TOOL_NAME,
		toolset: 'dev',
		available: ({ availability }) => availability.moduleGraphSupported,
		getMetadata: () => getStoriesByComponentToolMetadata(),
		register: (server, _context, enabled) => addGetStoriesByComponentTool(server, enabled),
	},
	{
		name: DISPLAY_REVIEW_TOOL_NAME,
		toolset: 'dev',
		available: ({ availability }) => availability.reviewEnabled,
		getMetadata: () => getDisplayReviewToolMetadata(),
		register: (server, _context, enabled) => addDisplayReviewTool(server, enabled),
	},
	{
		name: RUN_STORY_TESTS_TOOL_NAME,
		toolset: 'test',
		available: ({ availability }) => availability.testSupported,
		getMetadata: ({ availability }) =>
			getRunStoryTestsToolMetadata({ a11yEnabled: availability.a11yEnabled }),
		register: (server, { availability }, enabled) =>
			addRunStoryTestsTool(server, { a11yEnabled: availability.a11yEnabled }, enabled),
	},
	{
		name: LIST_TOOL_NAME,
		toolset: 'docs',
		available: ({ availability }) => availability.docsEnabled,
		getMetadata: () => getListAllDocumentationToolMetadata(),
		register: async (server, _context, enabled) => {
			logger.info(
				'Experimental components manifest feature detected - registering component tools',
			);
			await addListAllDocumentationTool(server, enabled);
		},
	},
	{
		name: GET_TOOL_NAME,
		toolset: 'docs',
		available: ({ availability }) => availability.docsEnabled,
		getMetadata: ({ multiSource }) => getDocumentationToolMetadata({ multiSource }),
		register: (server, { multiSource }, enabled) =>
			addGetDocumentationTool(server, enabled, {
				multiSource,
			}),
	},
	{
		name: GET_STORY_TOOL_NAME,
		toolset: 'docs',
		available: ({ availability }) => availability.docsEnabled,
		getMetadata: ({ multiSource }) => getStoryDocumentationToolMetadata({ multiSource }),
		register: (server, { multiSource }, enabled) =>
			addGetStoryDocumentationTool(server, enabled, {
				multiSource,
			}),
	},
];

export function getAddonToolMetadata(context: AddonToolRegistryContext): ToolMetadata[] {
	return addonToolDefinitions
		.filter((definition) => isMetadataToolEnabled(definition, context))
		.map((definition) => definition.getMetadata(context));
}

export function getAddonLocalTools(
	context: AddonToolRegistryContext & { options: Options },
): Record<string, StorybookAiLocalTool> {
	return Object.fromEntries(
		addonToolDefinitions
			.filter((definition) => isMetadataToolEnabled(definition, context))
			.flatMap((definition) => {
				const localTool = definition.getLocalTool?.(context);
				return localTool ? [[definition.name, localTool]] : [];
			}),
	);
}

export async function registerAddonMcpTools(
	server: McpServer<any, AddonContext>,
	context: AddonToolRegistryContext,
) {
	for (const definition of addonToolDefinitions) {
		if (
			isToolsetEnabled(definition.toolset, context.toolsets) &&
			isToolAvailable(definition, context)
		) {
			await definition.register(server, context, createToolsetEnabled(server, definition.toolset));
		}
	}
}
