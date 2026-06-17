import { resolve } from 'node:path';

import type { InterceptReason, StorybookInstanceRecord } from './types.ts';

export type ResolveResult =
  | {
      kind: 'instance';
      record: StorybookInstanceRecord;
      matches: StorybookInstanceRecord[];
    }
  | {
      kind: 'intercept';
      reason: InterceptReason;
      records?: StorybookInstanceRecord[];
      matches: StorybookInstanceRecord[];
    };

/**
 * Pick the Storybook instance whose cwd exactly matches `targetCwd` after normalisation. Per
 * milestone 2 of storybookjs/storybook#34826: matching is exact-normalized, with no longest-prefix
 * or fallback behaviour.
 *
 * When `targetPort` is supplied (e.g. an agent that launched Storybook on a known port and wants
 * to address that exact instance), it further constrains the cwd matches: an instance must match
 * BOTH cwd and port. If the cwd matches but no instance there is on `targetPort`, a
 * `port-mismatch` intercept is returned with the cwd's instances as candidates so callers can
 * surface the running ports.
 *
 * If at least one record matches, dispatch based on the selected instance's `mcp.status`:
 *
 * - `ready` → forward the call
 * - `starting` → mcp-starting intercept
 * - `not-installed` → addon-missing intercept
 * - `error` → mcp-error intercept
 *
 * Zero matches → no-instance intercept (callers may surface running cwds). 2+ matches at the same
 * cwd → pick the most recently started instance (latest `startedAt` among `ready` records, else
 * latest overall), on the assumption that the freshest instance is the one the agent just started.
 * Records without a `startedAt` tie-break on lowest pid for determinism. All matches are returned
 * (most-recent first) as `matches` so callers can warn the agent without blocking the call.
 */
export function resolveInstance(
  records: StorybookInstanceRecord[],
  targetCwd: string,
  targetPort?: number
): ResolveResult {
  const normalisedTarget = resolve(targetCwd);
  const cwdMatches = records.filter((r) => resolve(r.cwd) === normalisedTarget);
  const matches = targetPort == null ? cwdMatches : cwdMatches.filter((r) => r.port === targetPort);

  if (matches.length === 0) {
    // cwd matched, but no instance there is on the requested port: a distinct,
    // more actionable failure than "nothing is running here".
    if (targetPort != null && cwdMatches.length > 0) {
      return {
        kind: 'intercept',
        reason: 'port-mismatch',
        records: cwdMatches,
        matches: [],
      };
    }
    return {
      kind: 'intercept',
      reason: 'no-instance',
      records,
      matches: [],
    };
  }

  const sortedMatches = [...matches].sort(byMostRecentlyStarted);
  const selected = sortedMatches.find((r) => r.mcp.status === 'ready') ?? sortedMatches[0];

  switch (selected.mcp.status) {
    case 'ready':
      return {
        kind: 'instance',
        record: selected,
        matches: sortedMatches,
      };

    case 'starting':
      return {
        kind: 'intercept',
        reason: 'mcp-starting',
        matches: sortedMatches,
      };

    case 'not-installed':
      return {
        kind: 'intercept',
        reason: 'addon-missing',
        matches: sortedMatches,
      };

    case 'error':
      return {
        kind: 'intercept',
        reason: 'mcp-error',
        matches: sortedMatches,
      };

    default: {
      const unhandled: never = selected.mcp.status;
      throw new Error(`Unhandled MCP status: ${unhandled as string}`);
    }
  }
}

/**
 * `startedAt` as epoch millis, or `-Infinity` when absent/unparseable so such records sort as the
 * oldest (and fall through to the pid tie-break).
 */
function startedAtMs(r: StorybookInstanceRecord): number {
  if (!r.startedAt) {
    return Number.NEGATIVE_INFINITY;
  }
  const t = Date.parse(r.startedAt);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/**
 * Sort comparator: most recently started first, tie-breaking on lowest pid so ordering stays
 * deterministic when timestamps are equal or missing.
 */
function byMostRecentlyStarted(a: StorybookInstanceRecord, b: StorybookInstanceRecord): number {
  const ta = startedAtMs(a);
  const tb = startedAtMs(b);
  if (ta !== tb) {
    return tb > ta ? 1 : -1;
  }
  return a.pid - b.pid;
}
