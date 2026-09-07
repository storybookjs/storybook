import { telemetry } from 'storybook/internal/telemetry';

import type { ToolsetTelemetry } from '../../../shared/open-service/toolset-definition.ts';
import {
  parseToolsetMethodId,
  toCliMethodName,
} from '../../../shared/open-service/toolset-names.ts';
import { attachGateReasonFromError, type ToolsAttachGateReason } from './errors.ts';
import type { ToolsCallOptions, ToolsClientInfo, ToolsHostKind, ToolsMode } from './types.ts';

export type ToolsCommandOutcomeKind = 'success' | 'failure' | 'intercept' | 'error' | 'attach-gate';

export type ToolsCommandDimensions = {
  client: 'cli' | 'sdk';
  requestedMode: ToolsMode;
  resolvedMode?: 'attached' | 'local';
  attachMode: ToolsMode;
  host?: ToolsHostKind;
  attachGate?: ToolsAttachGateReason;
};

// One record per CLI or SDK invocation; `toolset` and `tool` are absent when no part was parsed.
export type ToolsCommandTelemetryPayload = ToolsCommandDimensions & {
  toolset?: string;
  tool?: string;
  success: boolean;
  outcome: ToolsCommandOutcomeKind;
  interceptReason?: string;
  multipleMatches?: boolean;
  duration?: number;
};

export type MethodReport = { event: string; payload: Record<string, unknown> };

// `sink` is absent only in a child host process, where the report travels over IPC to the parent.
export type CallTelemetry = {
  sink?: ToolsetTelemetry;
  report(): MethodReport | undefined;
};

// Names are a fixed vocabulary of short identifiers; anything else is arbitrary agent input (a
// typo'd path, a stray flag value) that must not be sent verbatim.
export function sanitizeNamePart(part: string): string {
  return /^[\w-]{1,64}$/.test(part) ? part : '(invalid)';
}

export function toolsCommandDimensions(args: {
  clientInfo: Pick<Required<ToolsClientInfo>, 'kind'>;
  requestedMode: ToolsMode;
  resolvedMode?: 'attached' | 'local';
  host?: ToolsHostKind;
  fallbackReason?: ToolsAttachGateReason;
}): ToolsCommandDimensions {
  return {
    client: args.clientInfo.kind,
    requestedMode: args.requestedMode,
    attachMode: args.resolvedMode ?? args.requestedMode,
    ...(args.resolvedMode ? { resolvedMode: args.resolvedMode } : {}),
    ...(args.host ? { host: args.host } : {}),
    ...(args.fallbackReason ? { attachGate: args.fallbackReason } : {}),
  };
}

export function commandPartsFromRef(ref: string): { toolset: string; tool: string } {
  try {
    const { toolsetId, methodName } = parseToolsetMethodId(ref);
    return {
      toolset: sanitizeNamePart(toolsetId),
      tool: sanitizeNamePart(toCliMethodName(methodName)),
    };
  } catch {
    return { toolset: '(invalid)', tool: '(invalid)' };
  }
}

export function wrapMethodTelemetry(
  sink: ToolsetTelemetry,
  dimensions: ToolsCommandDimensions
): ToolsetTelemetry {
  return async (event, payload) => {
    await sink(event, { ...dimensions, ...payload });
  };
}

// The caller's own sink, when given, still receives the report with the host dimensions.
export function resolveCallTelemetry(
  options: ToolsCallOptions,
  dimensions: ToolsCommandDimensions
): CallTelemetry {
  if (process.env.STORYBOOK_TOOLS_CHILD_HOST === 'true') {
    return { sink: options.telemetry, report: () => undefined };
  }
  let report: MethodReport | undefined;
  const forward = options.telemetry
    ? wrapMethodTelemetry(options.telemetry, dimensions)
    : undefined;
  return {
    sink: async (event, payload) => {
      report = { event, payload };
      await forward?.(event, payload);
    },
    report: () => report,
  };
}

// The handler's report is merged under the record: its `event` name and its counters, with the
// record's own fields winning.
export async function reportToolsCommandEvent(
  record: ToolsCommandTelemetryPayload,
  options: { report?: MethodReport; configDir?: string } = {}
): Promise<void> {
  const { report, configDir } = options;
  try {
    await telemetry(
      'tools-command',
      { ...report?.payload, ...(report ? { event: report.event } : {}), ...record },
      { configDir }
    );
  } catch {
    // Telemetry is never part of the tool's result contract.
  }
}

export function shouldReportSdkInvocation(kind: ToolsClientInfo['kind']): boolean {
  return kind === 'sdk' && process.env.STORYBOOK_TOOLS_CHILD_HOST !== 'true';
}

export async function reportSdkAttachGate(args: {
  error: unknown;
  clientInfo: Pick<Required<ToolsClientInfo>, 'kind'>;
  requestedMode: ToolsMode;
  configDir?: string;
}): Promise<void> {
  if (!shouldReportSdkInvocation(args.clientInfo.kind)) {
    return;
  }
  const attachGate = attachGateReasonFromError(args.error);
  await reportToolsCommandEvent(
    {
      success: false,
      outcome: 'attach-gate',
      ...toolsCommandDimensions({
        clientInfo: args.clientInfo,
        requestedMode: args.requestedMode,
        fallbackReason: attachGate,
      }),
    },
    { configDir: args.configDir }
  );
}

export async function reportSdkInvocation(args: {
  ref: string;
  clientInfo: Pick<Required<ToolsClientInfo>, 'kind'>;
  requestedMode: ToolsMode;
  resolvedMode: 'attached' | 'local';
  host: ToolsHostKind;
  fallbackReason?: ToolsAttachGateReason;
  result: { ok: boolean } | { error: unknown };
  report?: MethodReport;
  duration: number;
  configDir?: string;
}): Promise<void> {
  if (!shouldReportSdkInvocation(args.clientInfo.kind)) {
    return;
  }
  const dimensions = toolsCommandDimensions(args);
  const invoked = commandPartsFromRef(args.ref);
  const options = { report: args.report, configDir: args.configDir };
  if (!('ok' in args.result)) {
    const attachGate = attachGateReasonFromError(args.result.error);
    await reportToolsCommandEvent(
      {
        ...invoked,
        success: false,
        outcome: attachGate ? 'attach-gate' : 'error',
        duration: args.duration,
        ...dimensions,
        ...(attachGate ? { attachGate } : {}),
      },
      options
    );
    return;
  }
  const success = args.result.ok;
  await reportToolsCommandEvent(
    {
      ...invoked,
      success,
      outcome: success ? 'success' : 'failure',
      duration: args.duration,
      ...dimensions,
    },
    options
  );
}
