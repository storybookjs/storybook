import type { ToolAvailability } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import {
  createCompositionDocsSources,
  createDocsToolset,
  type DocsToolset,
} from 'storybook/internal/toolsets-docs';
import type { McpServer } from 'tmcp';
import type { AddonContext } from '../types.ts';
import { withFriendlyErrors } from '../utils/format-validation-issues.ts';
import { addPreviewStoriesResource, PREVIEW_STORIES_RESOURCE_URI } from './preview-stories.ts';
// The error class must come from the same entry as `getToolset` (which throws it, via
// `toolset-tools.ts`); a copy from another core entry is a different constructor and
// `instanceof` would silently fail.
import { OpenServiceMissingToolsetError, toMcpToolName } from 'storybook/open-service';
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

export type AddonToolRegistryContext = {
  availability: ToolAvailability;
  multiSource?: boolean;
};

type AddonToolDefinition = {
  name: string;
  available: (context: AddonToolRegistryContext) => boolean;
  getMetadata: (context: AddonToolRegistryContext) => ToolMetadata;
  register: (
    server: McpServer<any, AddonContext>,
    context: AddonToolRegistryContext
  ) => Promise<void>;
};

/**
 * Declares an MCP tool that is backed by a core toolset method.
 *
 * The addon contributes only what is specific to this surface: the availability gate and any
 * MCP-only metadata. Name, title, description, schemas, behaviour and telemetry all come from the
 * method.
 */
function fromToolset(definition: {
  options: ToolsetToolOptions;
  available?: (context: AddonToolRegistryContext) => boolean;
}): AddonToolDefinition {
  const { options, available = () => true } = definition;
  return {
    // Read from the constant, not the registry: this array is built at import time, while toolsets
    // register later from their preset hooks. Each availability gate is written to match the
    // condition under which its toolset registers; if they still disagree, resolution fails loudly
    // (getToolset throws) and the registry drops that one tool with an error log rather than taking
    // down the whole server (see resolveDefinitionOrDrop).
    name: toMcpToolName(options.method),
    available,
    getMetadata: () => getToolsetToolMetadata(options),
    register: async (server) => {
      registerToolsetTool(server, options);
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

const DOCS_EVENT_NAMES = {
  'docs.list': 'tool:listAllDocumentation',
  'docs.show': 'tool:getDocumentation',
  'docs.showStory': 'tool:getDocumentationForStory',
} as const;

/** The docs tools, in the two shapes the registry needs: registered toolset, or per-request one. */
function docsToolDefinition(method: keyof typeof DOCS_EVENT_NAMES): AddonToolDefinition {
  const forContext = (context: AddonToolRegistryContext): ToolsetToolOptions => ({
    method,
    mcpEventName: DOCS_EVENT_NAMES[method],
    ...(context.multiSource ? { resolveToolset: (server) => compositionDocsToolset(server) } : {}),
  });

  return {
    name: toMcpToolName(method),
    available: ({ availability }) => availability.docsEnabled,
    getMetadata: (context) => getToolsetToolMetadata(forContext(context)),
    register: async (server, context) => {
      registerToolsetTool(server, forContext(context));
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
    options: {
      method: 'stories.preview',
      mcpEventName: 'tool:previewStories',
      extras: { _meta: { ui: { resourceUri: PREVIEW_STORIES_RESOURCE_URI } } },
    },
  }),
  fromToolset({
    options: { method: 'stories.changed', mcpEventName: 'tool:getChangedStories' },
  }),
  fromToolset({
    available: ({ availability }) => availability.moduleGraphSupported,
    options: { method: 'stories.findByComponent', mcpEventName: 'tool:getStoriesByComponent' },
  }),
  fromToolset({
    options: {
      method: 'review.create',
      mcpEventName: 'tool:displayReview',
      wrapSchema: withFriendlyErrors,
    },
  }),
  fromToolset({
    available: ({ availability }) => availability.testSupported,
    options: { method: 'test.run', mcpEventName: 'tool:runStoryTests' },
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
 * condition), but it must cost the user one tool, not the whole MCP server — the error log keeps
 * it loud. Only this one error is contained: every other
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
    .filter((definition) => definition.available(context))
    .flatMap((definition) => {
      const metadata = resolveDefinitionOrDrop(definition.name, () =>
        definition.getMetadata(context)
      );
      return metadata ? [metadata] : [];
    });
}

export async function registerAddonMcpTools(
  server: McpServer<any, AddonContext>,
  context: AddonToolRegistryContext
) {
  await addPreviewStoriesResource(server);

  for (const definition of addonToolDefinitions) {
    if (definition.available(context)) {
      try {
        await definition.register(server, context);
      } catch (error) {
        dropToolIfToolsetMissing(definition.name, error);
      }
    }
  }
}
