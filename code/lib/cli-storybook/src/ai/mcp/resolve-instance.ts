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
 * If at least one record matches, dispatch based on the selected instance's `mcp.status`:
 *
 * - `ready` → forward the call
 * - `starting` → mcp-starting intercept
 * - `not-installed` → addon-missing intercept
 * - `error` → mcp-error intercept
 *
 * Zero matches → no-instance intercept (callers may surface running cwds). 2+ matches at the same
 * cwd → pick a deterministic instance (lowest pid among `ready` records, else lowest pid overall).
 * All matches are returned (sorted by pid) as `matches` so callers can warn the agent without
 * blocking the call.
 */
export function resolveInstance(
  records: StorybookInstanceRecord[],
  targetCwd: string
): ResolveResult {
  const normalisedTarget = resolve(targetCwd);
  const matches = records.filter((r) => resolve(r.cwd) === normalisedTarget);

  if (matches.length === 0) {
    return {
      kind: 'intercept',
      reason: 'no-instance',
      records,
      matches: [],
    };
  }

  const sortedMatches = [...matches].sort((a, b) => a.pid - b.pid);
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
  }
}
