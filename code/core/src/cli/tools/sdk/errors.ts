import { Category, StorybookError } from '../../../server-errors.ts';
import type { StorybookInstanceRecord } from '../instances/types.ts';

/** Why attaching to a running Storybook was not possible. */
export type AttachUnavailableReason =
  | 'no-instance'
  | 'port-mismatch'
  | 'old-server'
  | 'connection-failed';

/**
 * The requested capability needs a running Storybook and the SDK could not attach to one.
 *
 * `remediation` is the whole message: it is written for the agent or developer that triggered the
 * call and names the next step, which is what `agentFacing` declares. `instances` carries every
 * live record the SDK knows about so a caller can point at another project or resolve a
 * `port-mismatch` failure itself. Channel tokens are omitted so logging the error cannot leak
 * them.
 */
export class AttachUnavailableError extends StorybookError {
  public data: {
    reason: AttachUnavailableReason;
    instances: StorybookInstanceRecord[];
    remediation: string;
  };

  constructor(data: {
    reason: AttachUnavailableReason;
    instances: StorybookInstanceRecord[];
    remediation: string;
  }) {
    super({
      name: 'AttachUnavailableError',
      category: Category.CLI,
      code: 4,
      message: data.remediation,
      agentFacing: true,
    });
    this.data = {
      reason: data.reason,
      instances: data.instances.map((instance) => {
        const rest = { ...instance };
        delete rest.token;
        return rest;
      }),
      remediation: data.remediation,
    };
  }
}

/**
 * The instance record cannot prove which `storybook` installation the running Storybook is, or
 * the installations differ and spawning a child host from the recorded one is not allowed
 * (`autoSpawn: false`, or this process is already a child host). `reason` is the whole message
 * and names the recovery.
 */
export class EnvironmentMismatchError extends StorybookError {
  constructor(public data: { reason: string }) {
    super({
      name: 'EnvironmentMismatchError',
      category: Category.CLI,
      code: 5,
      message: data.reason,
      agentFacing: true,
    });
  }
}

/** The child host that would run the target project's tools could not be resolved or started. */
export class SpawnFailedError extends StorybookError {
  constructor(public data: { reason: string; cause?: unknown }) {
    super({
      name: 'SpawnFailedError',
      category: Category.CLI,
      code: 6,
      cause: data.cause,
      message: data.reason,
    });
  }
}

/** Why a tools runtime fault was raised. */
export type ToolsRuntimeErrorReason =
  | 'mode-unavailable'
  | 'config-load-failed'
  | 'closed'
  | 'unknown-toolset'
  | 'unknown-method'
  | 'invalid-input'
  | 'connection-lost'
  | 'command-unhandled';

/**
 * A tools runtime fault: the SDK could not run what was asked of it.
 *
 * Distinct from a tool that ran and reported bad news, which is an outcome with `ok: false` and
 * never an exception.
 */
export class ToolsRuntimeError extends StorybookError {
  constructor(
    public data: {
      reason: ToolsRuntimeErrorReason;
      message: string;
      cause?: unknown;
      /** Schema issues when `reason` is `invalid-input`. */
      issues?: ReadonlyArray<{
        message: string;
        path?: ReadonlyArray<PropertyKey | { key?: unknown }>;
      }>;
    }
  ) {
    super({
      name: 'ToolsRuntimeError',
      category: Category.CLI,
      code: 7,
      cause: data.cause,
      message: data.message,
    });
  }
}

export function isAttachGateError(
  error: unknown
): error is AttachUnavailableError | EnvironmentMismatchError | SpawnFailedError {
  return (
    error instanceof AttachUnavailableError ||
    error instanceof EnvironmentMismatchError ||
    error instanceof SpawnFailedError
  );
}

/** Why attached mode was not used, either as a hard failure or as an `auto` fallback. */
export type ToolsAttachGateReason =
  | AttachUnavailableReason
  | 'environment-mismatch'
  | 'spawn-failed';

export function attachGateReasonFromError(
  error: AttachUnavailableError | EnvironmentMismatchError | SpawnFailedError
): ToolsAttachGateReason;
export function attachGateReasonFromError(error: unknown): ToolsAttachGateReason | undefined;
export function attachGateReasonFromError(error: unknown): ToolsAttachGateReason | undefined {
  if (error instanceof AttachUnavailableError) {
    return error.data.reason;
  }
  if (error instanceof EnvironmentMismatchError) {
    return 'environment-mismatch';
  }
  if (error instanceof SpawnFailedError) {
    return 'spawn-failed';
  }
  return undefined;
}
