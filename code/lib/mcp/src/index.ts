import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { HttpTransport } from '@tmcp/transport-http';
import pkgJson from '../package.json' with { type: 'json' };
import {
  addGetDocumentationTool,
  addGetStoryDocumentationTool,
  addListAllDocumentationTool,
} from './tools/register.ts';
import type { StorybookContext } from './types.ts';
import { DOCS_TOOLSET_INSTRUCTIONS as serverInstructions } from 'storybook/internal/toolsets-docs';

export { serverInstructions as STORYBOOK_MCP_INSTRUCTIONS };

// The docs tools themselves come from Storybook's shared `docs` toolset; this package supplies the
// hosted runtime (manifest provider, composed sources) behind it.
export {
  addGetDocumentationTool,
  addGetStoryDocumentationTool,
  addListAllDocumentationTool,
  getDocumentationToolMetadata,
  getListAllDocumentationToolMetadata,
  getStoryDocumentationToolMetadata,
  GET_STORY_TOOL_NAME,
  GET_TOOL_NAME,
  LIST_TOOL_NAME,
} from './tools/register.ts';

// Export manifest constants and utilities
export {
  adaptCoreComponent,
  adaptCoreDoc,
  adaptCoreStories,
  COMPONENT_MANIFEST_PATH,
  DOCS_MANIFEST_PATH,
  RequiresOwnMcpError,
  resolveComponentEntry,
  resolveComponentStories,
  resolveDocEntry as resolveDoc,
} from 'storybook/internal/toolsets-docs';

export { getMultiSourceManifests } from './utils/multi-source-manifests.ts';

// Export types for reuse
export type {
  RequiresOwnMcpNotice,
  StorybookContext,
  ResolvedEntry,
  Source,
  SourceManifests,
  Doc,
  Story,
  CoreDocgenPayload,
  CoreDocgenComponent,
  CoreMdxPayload,
  CoreMdxDoc,
  CoreStoryDocsPayload,
  CoreStoryDoc,
} from './types.ts';

// copied from tmcp internals as it's not exposed
type InitializeRequestParams = {
  protocolVersion: string;
  capabilities: {
    experimental?: {} | undefined;
    sampling?: {} | undefined;
    elicitation?: {} | undefined;
    roots?:
      | {
          listChanged?: boolean | undefined;
        }
      | undefined;
  };
  clientInfo: {
    icons?:
      | {
          src: string;
          mimeType?: string | undefined;
          sizes?: string[] | undefined;
        }[]
      | undefined;
    version: string;
    websiteUrl?: string | undefined;
    name: string;
    title?: string | undefined;
  };
};

/**
 * Options for creating a Storybook MCP handler.
 * Extends StorybookContext with server-level configuration.
 */
export interface StorybookMcpHandlerOptions extends StorybookContext {
  /**
   * Optional handler called when an MCP session is initialized.
   * This is only valid at the handler creation level, not per-request.
   * Receives the initialize request parameters from the MCP protocol.
   */
  onSessionInitialize?: (initializeRequestParams: InitializeRequestParams) => void | Promise<void>;
}
export type { ComponentManifest } from './types.ts';
export { ComponentManifestMap, DocsManifestMap } from './types.ts';

type Handler = (req: Request, context?: StorybookContext) => Promise<Response>;

export const createStorybookMcpHandler = async (
  options: StorybookMcpHandlerOptions = {}
): Promise<Handler> => {
  const { onSessionInitialize, ...defaultContext } = options;
  const adapter = new ValibotJsonSchemaAdapter();
  const server = new McpServer(
    {
      name: pkgJson.name,
      version: pkgJson.version,
      description: pkgJson.description,
    },
    {
      adapter,
      instructions: serverInstructions,
      capabilities: {
        tools: { listChanged: true },
      },
    }
  ).withContext<StorybookContext>();

  if (onSessionInitialize) {
    server.on('initialize', onSessionInitialize);
  }

  await addListAllDocumentationTool(server);
  await addGetStoryDocumentationTool(server);
  await addGetDocumentationTool(server);

  const transport = new HttpTransport(server, { path: null });

  return (async (req, context) => {
    return await transport.respond(req, {
      ...defaultContext,
      ...context,
      request: req,
    });
  }) as Handler;
};
