/**
 * Registers the docs tools of a hosted Storybook from the shared core toolset.
 *
 * Everything an MCP client observes — the frozen tool names, the descriptions, the schemas and the
 * rendered text — comes from the toolset. This module contributes only what is specific to serving
 * a hosted Storybook: building the per-request access over the manifest provider, composing one
 * access per source, and the telemetry callbacks this package's embedders rely on.
 */

import type { McpServer } from 'tmcp';
import type { GenericSchema } from 'valibot';

import {
  createCompositionDocsSources,
  createDocsToolset,
  createProviderDocsAccess,
  emptyManifests,
  selectReportedManifests,
  ManifestGetError,
  RequiresOwnMcpError,
  resolveToolsetDescription,
  toMcpToolName,
  type DocsListOutput,
  type DocsSource,
  type DocsToolset,
  type ToolsetCtx,
  type ToolsetOutcome,
} from 'storybook/internal/toolsets-docs';

import type { StorybookContext } from '../types.ts';
import { errorToMCPContent } from '../utils/error-to-mcp-content.ts';
import { toSourceManifests } from '../utils/multi-source-manifests.ts';

export const LIST_TOOL_NAME = toMcpToolName('docs.list');
export const GET_TOOL_NAME = toMcpToolName('docs.show');
export const GET_STORY_TOOL_NAME = toMcpToolName('docs.showStory');

type Server = McpServer<any, StorybookContext>;
type ToolEnabled = Parameters<Server['tool']>[0]['enabled'];

const ctx: ToolsetCtx = {
  transport: 'mcp',
  getService: () => {
    throw new Error('Open services are not available in a hosted Storybook.');
  },
};

/**
 * The composed sources this request serves, or nothing when this Storybook stands alone.
 *
 * Only the "is this a composition" test is hosted-specific — a configured source without a URL is
 * this Storybook itself. Building the accesses is the shared helper's job, so hosted and dev-server
 * compositions cannot drift apart.
 */
function getSources(context: StorybookContext | undefined): DocsSource[] | undefined {
  const sources = context?.sources;
  if (!sources?.some((source) => source.url)) {
    return undefined;
  }

  return createCompositionDocsSources({
    sources,
    manifestProvider: context?.manifestProvider,
    getRequest: () => context?.request,
    resolveEntry: context?.resolveEntry,
  });
}

/**
 * Builds the toolset for one request.
 *
 * The manifests, the provider and the composed sources all belong to the request being served, so
 * the toolset is assembled per call. It is a plain object of schemas and functions, which is why
 * that is cheap enough to do rather than threading request state through a shared instance.
 */
function toolsetFor(context: StorybookContext | undefined): DocsToolset {
  const sources = getSources(context);
  if (sources) {
    return createDocsToolset({ sources });
  }

  return createDocsToolset({
    docsAccess: createProviderDocsAccess({
      manifestProvider: context?.manifestProvider,
      getRequest: () => context?.request,
      resolveEntry: context?.resolveEntry,
    }),
  });
}

/**
 * Metadata is read from a toolset with no access behind it: names, titles, descriptions and schemas
 * are static, and only `multiSource` changes them.
 */
function metadataToolset(multiSource: boolean): DocsToolset {
  const unavailable = { list: async () => emptyManifests(), resolve: async () => undefined };
  return multiSource
    ? createDocsToolset({
        sources: [{ source: { id: 'local', title: 'Local' }, access: unavailable }],
      })
    : createDocsToolset({ docsAccess: unavailable });
}

/**
 * What an embedder needs to register one of these tools on its own server.
 *
 * The type is written out rather than inferred: the schemas come from the bundled core toolset, so
 * an inferred signature would name valibot types this package's `.d.ts` cannot reference.
 */
export type DocsToolMetadata = {
  name: string;
  title: string;
  description: string;
  schema: GenericSchema;
  outputSchema?: GenericSchema;
};

function toolMetadata(
  method: 'docs.list' | 'docs.show' | 'docs.showStory',
  multiSource: boolean
): DocsToolMetadata {
  const [, methodName] = method.split('.') as [string, 'list' | 'show' | 'showStory'];
  const definition = metadataToolset(multiSource).methods[methodName];
  const outputSchema = outputSchemaOf(definition);

  return {
    name: toMcpToolName(method),
    title: definition.title,
    description: resolveToolsetDescription(definition.description, ctx),
    schema: definition.input,
    ...(outputSchema ? { outputSchema } : {}),
  };
}

export function getListAllDocumentationToolMetadata(options?: {
  multiSource?: boolean;
}): DocsToolMetadata {
  return toolMetadata('docs.list', !!options?.multiSource);
}

export function getDocumentationToolMetadata(options?: {
  multiSource?: boolean;
}): DocsToolMetadata {
  return toolMetadata('docs.show', !!options?.multiSource);
}

export function getStoryDocumentationToolMetadata(options?: {
  multiSource?: boolean;
}): DocsToolMetadata {
  return toolMetadata('docs.showStory', !!options?.multiSource);
}

/**
 * The one place this package crosses the tmcp type-inference boundary: tmcp types a tool's metadata
 * and handler from a literal schema generic, but these schemas come from the bundled core toolset
 * and resolve only at runtime, so registration steps out of that inference here.
 */
function registerTool(
  server: Server,
  metadata: DocsToolMetadata & { enabled?: ToolEnabled },
  handler: (input: never) => Promise<unknown>
): void {
  server.tool(metadata as never, handler as never);
}

/**
 * No docs method declares an output schema today, so the literal-inferred method types omit the
 * property; reading it structurally lets a method that gains one publish it without edits here.
 */
function outputSchemaOf(definition: unknown): GenericSchema | undefined {
  return (definition as { output?: GenericSchema }).output;
}

/**
 * Whether an error's prose speaks to the agent and names its own recovery.
 *
 * The trait is a property read, not a class list: it travels with the instance even across bundle
 * copies.
 */
function isAgentFacingError(error: unknown): error is Error {
  return error instanceof Error && (error as { agentFacing?: boolean }).agentFacing === true;
}

/**
 * Narrows outcome data to the published output contract.
 *
 * Outcomes may carry more data than the contract declares (the rendered Markdown needs it); only
 * the declared shape reaches `structuredContent`. A mismatch is a maintainer bug, thrown as a
 * plain error — core's typed class lives outside this package's dependency-light closure — and
 * lands in the generic catch below, which logs it and reports it as an unexpected failure.
 */
async function toStructuredContent(
  outputSchema: GenericSchema | undefined,
  data: unknown
): Promise<Record<string, unknown> | undefined> {
  if (!outputSchema || data === undefined) {
    return undefined;
  }
  const result = await outputSchema['~standard'].validate(data);
  if (result.issues) {
    // Validation issues embed the rejected input, which can be large or circular — the diagnostic
    // must never throw or balloon while reporting the real bug.
    let serialized: string;
    try {
      serialized = JSON.stringify(result.issues)?.slice(0, 2000) ?? String(result.issues);
    } catch {
      serialized = `${result.issues.length} issue(s) that could not be serialized`;
    }
    throw new Error(`Toolset output did not match its published output schema: ${serialized}`);
  }
  return result.value as Record<string, unknown>;
}

/**
 * Runs one method against the request's toolset and unwraps its outcome into an MCP result.
 *
 * A manifest that cannot be fetched or parsed is reported as tool output rather than thrown, so the
 * agent reads why instead of receiving a transport error. `data` is undefined in that case, which
 * is how the callers know to skip their telemetry hooks.
 */
async function call<TMethod extends 'list' | 'show' | 'showStory'>(
  server: Server,
  method: TMethod,
  input: unknown
) {
  const context = server.ctx.custom;

  try {
    const definition = toolsetFor(context).methods[method];
    const outcome = await (
      definition.handler as (i: unknown, c: ToolsetCtx) => Promise<ToolsetOutcome<unknown>>
    )(input, ctx);
    const structuredContent = await toStructuredContent(outputSchemaOf(definition), outcome.data);
    const blocks = Array.isArray(outcome.markdown) ? outcome.markdown : [outcome.markdown];

    return {
      data: outcome.data,
      result: {
        content: blocks.map((text) => ({ type: 'text' as const, text })),
        ...(structuredContent !== undefined ? { structuredContent } : {}),
        ...(outcome.ok ? {} : { isError: true as const }),
      },
    };
  } catch (error) {
    // An agent-facing error is surfaced as-is instead of being wrapped as an unexpected failure.
    if (isAgentFacingError(error)) {
      return {
        data: undefined,
        result: {
          content: [{ type: 'text' as const, text: error.message }],
          isError: true as const,
        },
      };
    }
    // Everything except the two designed answers (a source that needs its own MCP, an unreadable
    // manifest) is a bug whose only other evidence would be some agent's transcript. `console`
    // rather than a logger, because this package stays dependency-light and runtime-agnostic.
    if (!(error instanceof RequiresOwnMcpError) && !(error instanceof ManifestGetError)) {
      console.error(error);
    }
    return { data: undefined, result: errorToMCPContent(error) };
  }
}

export async function addListAllDocumentationTool(
  server: Server,
  enabled?: ToolEnabled,
  options?: { multiSource?: boolean }
) {
  registerTool(
    server,
    { ...getListAllDocumentationToolMetadata(options), enabled },
    async (input: unknown) => {
      const context = server.ctx.custom;
      const { data, result } = await call(server, 'list', input);

      // The embedder's hook predates the toolset and reports one source's manifests, so it picks
      // the same source the toolset's own usage event does.
      const listing = data as DocsListOutput | undefined;
      const manifests = listing && selectReportedManifests(listing);
      if (manifests) {
        await context?.onListAllDocumentation?.({
          context: context!,
          manifests,
          resultText: result.content[0].text,
          ...(listing?.sources ? { sources: listing.sources.map(toSourceManifests) } : {}),
        });
      }

      return result;
    }
  );
}

export async function addGetDocumentationTool(
  server: Server,
  enabled?: ToolEnabled,
  options?: { multiSource?: boolean }
) {
  registerTool(
    server,
    { ...getDocumentationToolMetadata(options), enabled },
    async (input: { id: string; storybookId?: string }) => {
      const context = server.ctx.custom;
      const { data, result } = await call(server, 'show', input);

      // Skipped when the manifest itself could not be read: that is a transport failure, not a
      // lookup with an outcome to report.
      if (data) {
        const { entry } = data as {
          entry?: { kind: string; component?: unknown; doc?: unknown };
        };
        const found = entry
          ? entry.kind === 'component'
            ? entry.component
            : entry.doc
          : undefined;

        await context?.onGetDocumentation?.(
          found
            ? {
                context: context!,
                input,
                foundDocumentation: found as never,
                resultText: result.content[0].text,
              }
            : { context: context!, input }
        );
      }

      return result;
    }
  );
}

export async function addGetStoryDocumentationTool(
  server: Server,
  enabled?: ToolEnabled,
  options?: { multiSource?: boolean }
) {
  registerTool(
    server,
    { ...getStoryDocumentationToolMetadata(options), enabled },
    async (input: unknown) => (await call(server, 'showStory', input)).result
  );
}
