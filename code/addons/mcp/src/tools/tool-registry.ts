import type { ToolAvailability } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import {
  createCompositionDocsSources,
  createDocsToolset,
  type DocsToolset,
} from 'storybook/internal/toolsets-docs';
import type { Options } from 'storybook/internal/types';
import type { McpServer } from 'tmcp';
import type { AddonContext } from '../types.ts';
import { withFriendlyErrors } from '../utils/format-validation-issues.ts';
import {
  addGetUIBuildingInstructionsTool,
  buildStorybookStoryInstructions,
  getStorybookStoryInstructionsToolMetadata,
} from './get-storybook-story-instructions.ts';
import { addPreviewStoriesResource, PREVIEW_STORIES_RESOURCE_URI } from './preview-stories.ts';
// The error class must come from the same entry as `getToolset` (which throws it, via
// `toolset-tools.ts`); a copy from another core entry is a different constructor and
// `instanceof` would silently fail.
import { OpenServiceMissingToolsetError, toMcpToolName } from 'storybook/open-service';
import { GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME } from './tool-names.ts';
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
    /** Narrows the tool further per request, on top of the toolset gate. */
    wrapEnabled?: (
      server: McpServer<any, AddonContext>,
      context: AddonToolRegistryContext,
      enabled: ToolEnabled
    ) => ToolEnabled;
  }
): AddonToolDefinition {
  const { options, available, wrapEnabled, ...rest } = definition;
  return {
    ...rest,
    // Read from the constant, not the registry: this array is built at import time, while toolsets
    // register later from their preset hooks. Each availability gate is written to match the
    // condition under which its toolset registers; if they still disagree, resolution fails loudly
    // (getToolset throws) and the registry drops that one tool with an error log rather than taking
    // down the whole server (see resolveDefinitionOrDrop).
    name: toMcpToolName(options.method),
    available: (context) => available?.(context) ?? true,
    getMetadata: () => getToolsetToolMetadata(options),
    register: async (server, context, enabled) => {
      registerToolsetTool(server, options, wrapEnabled?.(server, context, enabled) ?? enabled);
    },
  };
}

/**
 * Builds the docs toolset for a composition.
 *
 * The composed sources, their manifest provider and the local source's own access all arrive with
 * the request, so this cannot be the toolset registered once at boot. Called
 * without a server for metadata only, where the sources shape the schemas but nothing is fetched.
 */
function compositionDocsToolset(server?: McpServer<any, AddonContext>): DocsToolset {
  const custom = server?.ctx.custom;
  return createDocsToolset({
    sources: createCompositionDocsSources({
      sources: custom?.sources ?? [{ id: 'local', title: 'Local' }],
      manifestProvider: custom?.manifestProvider,
      getRequest: () => custom?.request,
      localAccess: custom?.localAccess,
    }),
  });
}

/** The docs tools, in the two shapes the registry needs: registered toolset, or per-request one. */
function docsToolDefinition(
  method: 'docs.list' | 'docs.show' | 'docs.showStory'
): AddonToolDefinition {
  const forContext = (context: AddonToolRegistryContext): ToolsetToolOptions =>
    context.multiSource
      ? { method, resolveToolset: (server) => compositionDocsToolset(server) }
      : { method };

  return {
    name: toMcpToolName(method),
    toolset: 'docs',
    available: ({ availability }) => availability.docsEnabled,
    getMetadata: (context) => getToolsetToolMetadata(forContext(context)),
    register: async (server, context, enabled) => {
      registerToolsetTool(server, forContext(context), enabled);
    },
  };
}

const docsToolDefinitions: AddonToolDefinition[] = [
  docsToolDefinition('docs.list'),
  docsToolDefinition('docs.show'),
  docsToolDefinition('docs.showStory'),
];

const addonToolDefinitions: AddonToolDefinition[] = [
  fromToolset({
    toolset: 'dev',
    options: {
      method: 'stories.preview',
      extras: { _meta: { ui: { resourceUri: PREVIEW_STORIES_RESOURCE_URI } } },
    },
  }),
  {
    name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
    toolset: 'dev',
    getMetadata: ({ availability, toolsets }) => {
      const testSupported = isToolsetEnabled('test', toolsets) && availability.testSupported;
      return getStorybookStoryInstructionsToolMetadata({
        testSupported,
        a11yAvailable: testSupported && availability.a11yEnabled,
      });
    },
    register: (server, { availability, toolsets }, enabled) =>
      addGetUIBuildingInstructionsTool(server, enabled, {
        docsEnabled: isToolsetEnabled('docs', toolsets) && availability.docsEnabled,
        addonVitestAvailable: availability.testSupported,
      }),
    getLocalTool: ({ availability, toolsets, options }) => ({
      call: async () => {
        const text = await buildStorybookStoryInstructions(options, {
          toolsets,
          a11yEnabled: availability.a11yEnabled,
          addonVitestAvailable: availability.testSupported,
          docsEnabled: isToolsetEnabled('docs', toolsets) && availability.docsEnabled,
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
  fromToolset({
    toolset: 'dev',
    available: ({ availability }) => availability.moduleGraphSupported,
    options: { method: 'stories.findByComponent' },
  }),
  fromToolset({
    toolset: 'dev',
    // Registered whenever the CLI default could turn review on; the per-request `reviewEnabled`
    // context (explicit flag, or the trusted local-client header) decides whether a given MCP
    // client actually sees the tool.
    available: ({ availability }) => availability.reviewEnabledForCli,
    wrapEnabled:
      (server, { availability }, enabled) =>
      async () =>
        ((await enabled?.()) ?? true) &&
        (server.ctx.custom?.reviewEnabled ?? availability.reviewEnabled),
    options: {
      method: 'review.create',
      wrapSchema: withFriendlyErrors,
    },
  }),
  fromToolset({
    toolset: 'test',
    available: ({ availability }) => availability.testSupported,
    options: { method: 'test.run' },
  }),
  // Docs run on the core docs toolset in both modes. A composition builds its toolset per request,
  // because the sources it reads and the provider that fetches them belong to the request.
  ...docsToolDefinitions,
];

/**
 * Logs and drops one tool when its availability gate said yes but the backing toolset never
 * registered.
 *
 * That mismatch is a wiring bug (each gate is written to match its toolset's registration
 * condition), but it must cost the user one tool, not the whole MCP server or the `storybook ai`
 * metadata build — the error log keeps it loud. Only this one error is contained: every other
 * failure rethrows, so a genuinely broken adapter still fails fast.
 */
function dropToolIfToolsetMissing(name: string, error: unknown): undefined {
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
    return dropToolIfToolsetMissing(name, error);
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
  // The preview app resource ships with the preview tool: when the dev toolset is disabled the
  // tool is absent, and the resource must not appear in resources/list either — the same boot
  // gate the tool's own registration uses below.
  if (isToolsetEnabled('dev', context.toolsets)) {
    await addPreviewStoriesResource(server);
  }

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
        dropToolIfToolsetMissing(definition.name, error);
      }
    }
  }
}
