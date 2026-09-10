import { telemetry } from 'storybook/internal/telemetry';

import type { ToolsetMethodReport } from '../../../shared/open-service/toolset-definition.ts';
import {
  parseToolsetMethodId,
  toCliMethodName,
} from '../../../shared/open-service/toolset-names.ts';
import { attachGateReasonFromError, type ToolsAttachGateReason } from './errors.ts';
import type { ToolsClientInfo, ToolsHostKind, ToolsMode } from './types.ts';

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

/** The record as sent: the run's fields plus the handler's event name and payload, when it ran. */
export type ToolsCommandTelemetryRecord = ToolsCommandTelemetryPayload & {
  event?: string;
  [field: string]: unknown;
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

// The record describes the run and wins over the handler's payload; the report names the method
// and wins over whatever the caller parsed, so a record always carries the registered spelling.
export async function reportToolsCommandEvent(
  record: ToolsCommandTelemetryPayload,
  options: { report?: ToolsetMethodReport; configDir?: string } = {}
): Promise<void> {
  const { report, configDir } = options;
  const payload: ToolsCommandTelemetryRecord = report
    ? {
        ...report.payload,
        ...record,
        event: report.event,
        toolset: report.toolset,
        tool: report.tool,
      }
    : record;
  try {
    await telemetry('tools-command', payload, { configDir });
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
  report?: ToolsetMethodReport;
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
