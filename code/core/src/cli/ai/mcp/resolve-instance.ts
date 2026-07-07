import { resolve } from 'node:path';

import {
  CLAUDE_AGENT_NAME,
  CLAUDE_PREVIEW_AGENT_NAME,
} from '../../../shared/constants/agent-provenance.ts';
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

export type ResolveTarget = {
  /** Normalised before matching; usually the CLI's `--cwd` or `process.cwd()`. */
  cwd: string;
  /**
   * Resolved config directory the CLI is targeting (from `--config-dir`, or the `.storybook`
   * default under `cwd`). Matched against the `configDir` recorded by `storybook dev`.
   */
  configDir?: string;
  /** Port of the target Storybook, to address one specific instance among the matches. */
  port?: number;
  /** The invoking agent (std-env name), used to pick among competing matches. */
  agent?: string;
};

/**
 * Pick the Storybook instance that matches the target project: its recorded `cwd` equals
 * `target.cwd`, OR its recorded `configDir` equals `target.configDir`. Both comparisons are
 * exact-normalized with no longest-prefix or fallback behaviour (milestone 2 of
 * storybookjs/storybook#34826). The configDir key exists for monorepos
 * (storybookjs/storybook#35359): a dev server started at the repo root with
 * `-c packages/ui/.storybook` must be found by a CLI run from `packages/ui`, and vice versa.
 * Records from older Storybooks carry no `configDir` and can only match by cwd.
 *
 * When `target.port` is supplied (e.g. an agent that launched Storybook on a known port and wants
 * to address that exact instance), it further constrains the project matches: an instance must
 * match BOTH the project and the port. If the project matches but no instance there is on the
 * port, a `port-mismatch` intercept is returned with the project's instances as candidates so
 * callers can surface the running ports.
 *
 * If at least one record matches, dispatch based on the selected instance's `mcp.status`:
 *
 * - `ready` → forward the call
 * - `starting` → mcp-starting intercept
 * - `not-installed` → addon-missing intercept
 * - `error` → mcp-error intercept
 *
 * Zero matches → no-instance intercept (callers may surface the running instances). 2+ matches →
 * use the current agent to select the competing bucket, then pick the most recently started
 * instance in that bucket (latest `startedAt` among `ready` records, else latest overall). Records
 * without a `startedAt` tie-break on lowest pid for determinism. The selected bucket is returned
 * (most-recent first) as `matches` so callers can warn only about instances that competed.
 */
export function resolveInstance(
  records: StorybookInstanceRecord[],
  target: ResolveTarget
): ResolveResult {
  const { port: targetPort, agent: currentAgent } = target;
  const normalisedCwd = resolve(target.cwd);
  const normalisedConfigDir = target.configDir == null ? undefined : resolve(target.configDir);
  const projectMatches = records.filter(
    (r) =>
      resolve(r.cwd) === normalisedCwd ||
      (normalisedConfigDir != null &&
        r.configDir != null &&
        resolve(r.configDir) === normalisedConfigDir)
  );
  const matches =
    targetPort == null ? projectMatches : projectMatches.filter((r) => r.port === targetPort);

  if (matches.length === 0) {
    // The project matched, but no instance there is on the requested port: a distinct,
    // more actionable failure than "nothing is running here".
    if (targetPort != null && projectMatches.length > 0) {
      return {
        kind: 'intercept',
        reason: 'port-mismatch',
        records: projectMatches,
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

  const sortedMatches = selectCompetingBucket(matches, targetPort, currentAgent);
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

function selectCompetingBucket(
  matches: StorybookInstanceRecord[],
  targetPort: number | undefined,
  currentAgent: string | undefined
) {
  if (targetPort != null) {
    return [...matches].sort(byMostRecentlyStarted);
  }

  // std-env reports Claude CLI as `claude`; preview-launched Storybooks record `claude-preview`.
  const agentBuckets =
    currentAgent === CLAUDE_AGENT_NAME
      ? [CLAUDE_PREVIEW_AGENT_NAME, CLAUDE_AGENT_NAME]
      : currentAgent
        ? [currentAgent]
        : [];
  const selectedAgent = agentBuckets.find((agent) => matches.some((r) => r.agent === agent));
  const bucket = selectedAgent ? matches.filter((r) => r.agent === selectedAgent) : matches;

  return [...bucket].sort(byMostRecentlyStarted);
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
