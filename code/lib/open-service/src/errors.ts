import { versions } from '@storybook/core/internal/common';
import {
  Category,
  LegacyAdapterMissingError,
  StorybookError,
} from '@storybook/core/internal/server-errors';
import {
  deserializeError,
  type SerializedError,
} from '@storybook/core/internal/deep/shared/open-service/service-error-serialization';
import type { StorybookInstanceRecord } from './instances/types.ts';

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
 * The instance record cannot prove which `@storybook/core` installation the running Storybook is, or
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

/** Wrap a failure to load the target configuration, naming the install a legacy preset needs. */
export function configLoadFailed(error: unknown): ToolsRuntimeError {
  const detail =
    error instanceof LegacyAdapterMissingError
      ? `It uses legacy presets ("${error.data.name}"), which need the \`storybook\` package, which is not installed. Install \`storybook@${versions['@storybook/core']}\` next to \`@storybook/core\`, then retry.`
      : error instanceof Error
        ? error.message
        : String(error);
  return new ToolsRuntimeError({
    reason: 'config-load-failed',
    message: `Could not load the Storybook configuration for this project: ${detail}`,
    cause: error,
  });
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

/**
 * Rebuilds an error another process sent (a child host or an attached dev server), restoring this
 * package's error classes so callers can keep using `instanceof`.
 */
export function rehydrateSerializedToolsError(serialized: SerializedError): Error {
  const plain = deserializeError(serialized);
  const data = (plain as { data?: unknown }).data;
  if (data === undefined || data === null || typeof data !== 'object') {
    return plain;
  }
  switch (toolsErrorKind(serialized)) {
    case 'AttachUnavailableError':
      return new AttachUnavailableError(data as AttachUnavailableError['data']);
    case 'EnvironmentMismatchError':
      return new EnvironmentMismatchError(data as EnvironmentMismatchError['data']);
    case 'SpawnFailedError':
      return new SpawnFailedError(data as SpawnFailedError['data']);
    case 'ToolsRuntimeError':
      return new ToolsRuntimeError(data as ToolsRuntimeError['data']);
    default:
      return plain;
  }
}

function toolsErrorKind(serialized: SerializedError): string {
  const fromProps = serialized.properties?._name;
  if (typeof fromProps === 'string') {
    return fromProps;
  }
  const match = serialized.name.match(/\(([^)]+)\)$/);
  return match?.[1] ?? serialized.name;
}
