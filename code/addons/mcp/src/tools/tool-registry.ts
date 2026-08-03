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
// The error class must come from the same entry as `getToolset` (which throws it, via
// `toolset-tools.ts`); a copy from another core entry is a different constructor and
// `instanceof` would silently fail.
import { MCP_TOOL_NAMES, OpenServiceMissingToolsetError } from 'storybook/open-service';
import {
  DISPLAY_REVIEW_TOOL_NAME,
  GET_STORIES_BY_COMPONENT_TOOL_NAME,
  GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
  PREVIEW_STORIES_TOOL_NAME,
  RUN_STORY_TESTS_TOOL_NAME,
} from './tool-names.ts';
import {
  getToolsetToolMetadata,
  registerToolsetTool,
  type ToolsetToolOptions,
} from './toolset-tools.ts';

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
    enabled: ToolEnabled
  ) => Promise<void>;
  getLocalTool?: (context: AddonToolRegistryContext & { options: Options }) => StorybookAiLocalTool;
};

const isToolsetEnabled = (toolset: AddonToolset, toolsets: AddonContext['toolsets'] | undefined) =>
  toolsets?.[toolset] ?? true;

const isToolAvailable = (definition: AddonToolDefinition, context: AddonToolRegistryContext) =>
  definition.available?.(context) ?? true;

const isMetadataToolEnabled = (
  definition: AddonToolDefinition,
  context: AddonToolRegistryContext
) => isToolsetEnabled(definition.toolset, context.toolsets) && isToolAvailable(definition, context);

const createToolsetEnabled =
  (server: McpServer<any, AddonContext>, toolset: AddonToolset): ToolEnabled =>
  () =>
    server.ctx.custom?.toolsets?.[toolset] ?? true;

/**
 * Declares an MCP tool that is backed by a core toolset method.
 *
 * The addon contributes only what is specific to this surface: the MCP toolset grouping, the
 * availability gate, and any MCP-only metadata. Name, title, description, schemas, behaviour and
 * telemetry all come from the method.
 */
function fromToolset(
  definition: Omit<AddonToolDefinition, 'name' | 'getMetadata' | 'register'> & {
    options: ToolsetToolOptions;
    available?: (context: AddonToolRegistryContext) => boolean;
  }
): AddonToolDefinition {
  const { options, available, ...rest } = definition;
  return {
    ...rest,
    // Read from the constant, not the registry: this array is built at import time, while toolsets
    // register later from their preset hooks. Each availability gate is written to match the
    // condition under which its toolset registers; if they still disagree, resolution fails loudly
    // (getToolset throws) and the registry drops that one row with an error log rather than taking
    // down the whole server (see resolveDefinitionOrDrop).
    name: MCP_TOOL_NAMES[options.method],
    available: (context) => available?.(context) ?? true,
    getMetadata: () => getToolsetToolMetadata(options),
    register: async (server, context, enabled) => {
      registerToolsetTool(server, options, enabled);
    },
  };
}

const addonToolDefinitions: AddonToolDefinition[] = [
  {
    name: PREVIEW_STORIES_TOOL_NAME,
    toolset: 'dev',
    getMetadata: ({ availability }) =>
      getPreviewStoriesToolMetadata({ reviewEnabled: availability.reviewEnabled }),
    register: (server, { availability }, enabled) =>
      addPreviewStoriesTool(server, enabled, { reviewEnabled: availability.reviewEnabled }),
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
    register: (server, { availability, toolsets }, enabled) =>
      addGetUIBuildingInstructionsTool(server, enabled, {
        docsAvailable: isToolsetEnabled('docs', toolsets) && availability.docsEnabled,
      }),
    getLocalTool: ({ availability, toolsets, options }) => ({
      call: async () => {
        const text = await buildStorybookStoryInstructions(options, {
          toolsets,
          a11yEnabled: availability.a11yEnabled,
          addonVitestAvailable: availability.testSupported,
          docsAvailable: isToolsetEnabled('docs', toolsets) && availability.docsEnabled,
          reviewEnabled: availability.reviewEnabled,
        });
        return { content: [{ type: 'text', text }] };
      },
    }),
  },
  fromToolset({
    toolset: 'dev',
    available: ({ availability }) => availability.changeDetectionEnabled,
    options: { method: 'stories.changed' },
  }),
  {
    name: GET_STORIES_BY_COMPONENT_TOOL_NAME,
    toolset: 'dev',
    available: ({ availability }) => availability.moduleGraphSupported,
    getMetadata: ({ availability }) =>
      getStoriesByComponentToolMetadata({ reviewEnabled: availability.reviewEnabled }),
    register: (server, { availability }, enabled) =>
      addGetStoriesByComponentTool(server, enabled, {
        reviewEnabled: availability.reviewEnabled,
      }),
  },
  {
    name: DISPLAY_REVIEW_TOOL_NAME,
    toolset: 'dev',
    // Registered whenever the CLI default could turn review on; the per-request
    // `reviewEnabled` context (explicit flag, or the trusted local-client header)
    // decides whether a given MCP client actually sees the tool.
    available: ({ availability }) => availability.reviewEnabledForCli,
    getMetadata: () => getDisplayReviewToolMetadata(),
    register: (server, { availability }, enabled) =>
      addDisplayReviewTool(
        server,
        async () =>
          ((await enabled?.()) ?? true) &&
          (server.ctx.custom?.reviewEnabled ?? availability.reviewEnabled)
      ),
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
        'Experimental components manifest feature detected - registering component tools'
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

/**
 * Logs and drops one tool row when its availability gate said yes but the backing toolset never
 * registered.
 *
 * That mismatch is a wiring bug (each gate is written to match its toolset's registration
 * condition), but it must cost the user one tool, not the whole MCP server or the `storybook ai`
 * metadata build — the error log keeps it loud. Only this one error is contained: every other
 * failure rethrows, so a genuinely broken adapter still fails fast.
 */
function dropRowIfToolsetMissing(name: string, error: unknown): undefined {
  if (!(error instanceof OpenServiceMissingToolsetError)) {
    throw error;
  }
  logger.error(`Skipping MCP tool "${name}", its backing toolset is not registered: ${error}`);
  return undefined;
}

function resolveDefinitionOrDrop<T>(name: string, resolve: () => T): T | undefined {
  try {
    return resolve();
  } catch (error) {
    return dropRowIfToolsetMissing(name, error);
  }
}

export function getAddonToolMetadata(context: AddonToolRegistryContext): ToolMetadata[] {
  return addonToolDefinitions
    .filter((definition) => isMetadataToolEnabled(definition, context))
    .flatMap((definition) => {
      const metadata = resolveDefinitionOrDrop(definition.name, () =>
        definition.getMetadata(context)
      );
      return metadata ? [metadata] : [];
    });
}

export function getAddonLocalTools(
  context: AddonToolRegistryContext & { options: Options }
): Record<string, StorybookAiLocalTool> {
  return Object.fromEntries(
    addonToolDefinitions
      .filter((definition) => isMetadataToolEnabled(definition, context))
      .flatMap((definition) => {
        const localTool = resolveDefinitionOrDrop(definition.name, () =>
          definition.getLocalTool?.(context)
        );
        return localTool ? [[definition.name, localTool]] : [];
      })
  );
}

export async function registerAddonMcpTools(
  server: McpServer<any, AddonContext>,
  context: AddonToolRegistryContext
) {
  for (const definition of addonToolDefinitions) {
    if (
      isToolsetEnabled(definition.toolset, context.toolsets) &&
      isToolAvailable(definition, context)
    ) {
      try {
        await definition.register(
          server,
          context,
          createToolsetEnabled(server, definition.toolset)
        );
      } catch (error) {
        dropRowIfToolsetMissing(definition.name, error);
      }
    }
  }
}
