/**
 * Adapter from core's public toolsets to MCP tools.
 *
 * Everything an MCP client can observe stays here — the derived tool names, the transport, the
 * session, and the app resource — while the data, prose and telemetry payloads come from the
 * toolset the method belongs to.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';
import { getService } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { OpenServiceToolsetOutputMismatchError } from 'storybook/internal/server-errors';
import {
  getToolset,
  resolveToolsetDescription,
  toMcpToolName,
  type AnyToolsetDefinition,
  type AnyToolsetOutcome,
  type ToolsetCtx,
  type ToolsetMethod,
  type ToolsetMethodId,
} from 'storybook/open-service';
import type { McpServer } from 'tmcp';

import { collectTelemetry } from '../telemetry.ts';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import { resolveToolsetOrigin } from './toolset-origin.ts';
import type { StorybookAiToolCallResult } from './tool-registry.ts';

type Server = McpServer<any, AddonContext>;
type ToolEnabled = Parameters<Server['tool']>[0]['enabled'];

export type ToolsetToolOptions = {
  /** Which toolset method backs this MCP tool. */
  method: ToolsetMethodId;
  /** Extra MCP-only tool metadata, e.g. the preview app resource. */
  extras?: Record<string, unknown>;
  /** Wraps the input schema before publishing it (used for friendlier validation errors). */
  wrapSchema?: (schema: StandardSchemaV1) => StandardSchemaV1;
  /**
   * Supplies the toolset instead of the registry.
   *
   * A composition's docs tools read state that belongs to the request being served (its manifest
   * provider and composed sources), so their toolset is built per call rather than registered once
   * at boot. Called without a server when only static metadata is needed.
   */
  resolveToolset?: (server?: Server) => AnyToolsetDefinition;
};

function resolveToolset(options: ToolsetToolOptions, server?: Server): AnyToolsetDefinition {
  if (options.resolveToolset) {
    return options.resolveToolset(server);
  }
  const [toolsetId] = options.method.split('.');
  return getToolset(toolsetId);
}

function resolveMethod(
  toolset: AnyToolsetDefinition,
  options: ToolsetToolOptions
): ToolsetMethod<any, AnyToolsetOutcome> {
  const [, methodName] = options.method.split('.');
  return toolset.methods[methodName];
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
 * the declared shape reaches `structuredContent`.
 */
async function toStructuredContent(
  outputSchema: StandardSchemaV1 | undefined,
  data: unknown
): Promise<Record<string, unknown> | undefined> {
  if (!outputSchema || data === undefined) {
    return undefined;
  }
  const result = await outputSchema['~standard'].validate(data);
  if (result.issues) {
    throw new OpenServiceToolsetOutputMismatchError({ issues: result.issues });
  }
  return result.value as Record<string, unknown>;
}

function buildContext(server: Server): ToolsetCtx {
  const custom = server.ctx.custom;
  return {
    transport: 'mcp',
    // The toolset origin is the complete UI base URL, including any deployment subpath.
    origin: resolveToolsetOrigin(custom ?? {}),
    getService: (serviceId, serviceOptions) => getService(serviceId as any, serviceOptions) as any,
    telemetry: custom?.disableTelemetry
      ? undefined
      : async (event, payload) => {
          await collectTelemetry({
            event,
            server,
            ...payload,
          });
        },
  };
}

/** Runs one toolset method and unwraps its outcome into an MCP tool result. */
export async function callToolsetMethod(
  server: Server,
  options: ToolsetToolOptions,
  input: unknown
): Promise<StorybookAiToolCallResult> {
  const toolset = resolveToolset(options, server);
  const method = resolveMethod(toolset, options);
  const ctx = buildContext(server);

  try {
    const outcome = await method.handler(input as never, ctx);
    const structuredContent = await toStructuredContent(method.output, outcome.data);
    const blocks = Array.isArray(outcome.markdown) ? outcome.markdown : [outcome.markdown];

    return {
      content: blocks.map((text) => ({ type: 'text' as const, text })),
      ...(structuredContent !== undefined ? { structuredContent } : {}),
      ...(outcome.ok ? {} : { isError: true }),
    };
  } catch (error) {
    // An agent-facing error is surfaced as-is instead of being wrapped as an unexpected failure.
    if (isAgentFacingError(error)) {
      return { content: [{ type: 'text', text: error.message }], isError: true };
    }
    // Everything else is a bug whose only other evidence would be the calling agent's transcript;
    // the terminal is the maintainer's channel.
    logger.error(`MCP tool "${toMcpToolName(options.method)}" failed: ${error}`);
    return errorToMCPContent(error);
  }
}

/** Metadata for one toolset-backed MCP tool, with the frozen name and title. */
export function getToolsetToolMetadata(options: ToolsetToolOptions) {
  const method = resolveMethod(resolveToolset(options), options);
  const descriptionCtx: ToolsetCtx = {
    transport: 'mcp',
    getService: (serviceId, serviceOptions) => getService(serviceId as any, serviceOptions) as any,
  };

  // A zero-input method publishes no input schema, matching the hand-written tools it replaced.
  const entries = (method.input as { entries?: Record<string, unknown> }).entries;
  const hasInput = !entries || Object.keys(entries).length > 0;

  return {
    name: toMcpToolName(options.method),
    title: method.title,
    description: resolveToolsetDescription(method.description, descriptionCtx),
    ...(hasInput
      ? { schema: options.wrapSchema ? options.wrapSchema(method.input) : method.input }
      : {}),
    ...(method.output ? { outputSchema: method.output } : {}),
    ...options.extras,
  };
}

/** Registers one toolset-backed MCP tool. */
export function registerToolsetTool(
  server: Server,
  options: ToolsetToolOptions,
  enabled: ToolEnabled
): void {
  // tmcp types the handler from the literal schema generic; toolset schemas resolve at runtime,
  // so both sides step out of that inference.
  server.tool(
    { ...getToolsetToolMetadata(options), enabled } as never,
    ((input: unknown) => callToolsetMethod(server, options, input)) as never
  );
}
