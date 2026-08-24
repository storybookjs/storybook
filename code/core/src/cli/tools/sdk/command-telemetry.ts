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

export type ToolsCommandTelemetryPayload = ToolsCommandDimensions & {
  command: string;
  success: boolean;
  outcome: ToolsCommandOutcomeKind;
  interceptReason?: string;
  duration?: number;
};

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

export function commandNameFromRef(ref: string): string {
  try {
    const { toolsetId, methodName } = parseToolsetMethodId(ref);
    return `${toolsetId} ${toCliMethodName(methodName)}`;
  } catch {
    return '(invalid)';
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

export function defaultMethodTelemetrySink(configDir?: string): ToolsetTelemetry {
  return async (event, payload) => {
    await telemetry('tools-command', { event, ...payload }, { configDir });
  };
}

export function resolveCallTelemetry(
  options: ToolsCallOptions,
  dimensions: ToolsCommandDimensions,
  args: { clientInfo: Pick<Required<ToolsClientInfo>, 'kind'>; configDir?: string }
): ToolsetTelemetry | undefined {
  const isChildHost = process.env.STORYBOOK_TOOLS_CHILD_HOST === 'true';
  const sink =
    options.telemetry ??
    (!isChildHost && shouldReportSdkInvocation(args.clientInfo.kind)
      ? defaultMethodTelemetrySink(args.configDir)
      : undefined);
  if (!sink) {
    return undefined;
  }
  return isChildHost ? sink : wrapMethodTelemetry(sink, dimensions);
}

export async function reportToolsCommandEvent(
  payload: ToolsCommandTelemetryPayload,
  options?: { configDir?: string }
): Promise<void> {
  try {
    await telemetry('tools-command', payload, options);
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
      command: '(none)',
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
  duration: number;
  configDir?: string;
}): Promise<void> {
  if (!shouldReportSdkInvocation(args.clientInfo.kind)) {
    return;
  }
  const dimensions = toolsCommandDimensions(args);
  if (!('ok' in args.result)) {
    const attachGate = attachGateReasonFromError(args.result.error);
    await reportToolsCommandEvent(
      {
        command: commandNameFromRef(args.ref),
        success: false,
        outcome: attachGate ? 'attach-gate' : 'error',
        duration: args.duration,
        ...dimensions,
        ...(attachGate ? { attachGate } : {}),
      },
      { configDir: args.configDir }
    );
    return;
  }
  const success = args.result.ok;
  await reportToolsCommandEvent(
    {
      command: commandNameFromRef(args.ref),
      success,
      outcome: success ? 'success' : 'failure',
      duration: args.duration,
      ...dimensions,
    },
    { configDir: args.configDir }
  );
}
