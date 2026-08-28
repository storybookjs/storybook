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
  /**
   * True when `configDir` came from an explicit `--config-dir` flag rather than the `.storybook`
   * default under `cwd`. An explicit config dir expresses precise intent, so matching is then
   * restricted to records with that exact configDir: a same-cwd instance serving a different
   * config must not win over the flag.
   */
  configDirExplicit?: boolean;
  /** Port of the target Storybook, to address one specific instance among the matches. */
  port?: number;
  /** The invoking agent (std-env name), used to pick among competing matches. */
  agent?: string;
};

/**
 * Pick the Storybook instance that matches the target project. With an explicit `--config-dir`
 * (`configDirExplicit`), only records whose recorded `configDir` equals `target.configDir` match.
 * Otherwise a record matches when its recorded `cwd` equals `target.cwd` OR its recorded
 * `configDir` equals the defaulted `target.configDir`. All comparisons are exact-normalized with
 * no longest-prefix or fallback behaviour (milestone 2 of storybookjs/storybook#34826). The
 * configDir key exists for monorepos (storybookjs/storybook#35359): a dev server started at the
 * repo root with `-c packages/ui/.storybook` must be found by a CLI run from `packages/ui`, and
 * vice versa. Records from older Storybooks carry no `configDir` and can only match by cwd — so
 * an explicit `--config-dir` cannot select them, and the no-instance guidance offers their
 * `--cwd` instead.
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
  const selection = selectInstances(records, target);
  if (selection.kind === 'port-mismatch') {
    return {
      kind: 'intercept',
      reason: 'port-mismatch',
      records: selection.projectMatches,
      matches: [],
    };
  }
  if (selection.kind === 'no-instance') {
    return {
      kind: 'intercept',
      reason: 'no-instance',
      records: selection.records,
      matches: [],
    };
  }

  const sortedMatches = selection.matches;
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

export type InstanceSelection =
  | {
      kind: 'match';
      /** The competing bucket, best first: the selected agent bucket, most recently started first. */
      matches: StorybookInstanceRecord[];
    }
  | { kind: 'no-instance'; records: StorybookInstanceRecord[] }
  | { kind: 'port-mismatch'; port: number; projectMatches: StorybookInstanceRecord[] };

/**
 * The selection half of {@link resolveInstance}: match records against the target project, restrict
 * to `target.port` when supplied, then order the competing bucket best-first (the invoking agent's
 * bucket wins over recency across buckets; within the bucket, most recently started first with a
 * lowest-pid tie-break). MCP status plays no role — the attach path consumes this directly because
 * attaching over the channel works without `@storybook/addon-mcp`.
 *
 * A supplied port that matches the project but no instance yields `port-mismatch` with the
 * project's instances, so callers can surface the running ports.
 */
export function selectInstances(
  records: StorybookInstanceRecord[],
  target: ResolveTarget
): InstanceSelection {
  const { port: targetPort, agent: currentAgent } = target;
  const projectMatches = listProjectMatches(records, target);
  const matches =
    targetPort == null ? projectMatches : projectMatches.filter((r) => r.port === targetPort);

  if (matches.length === 0) {
    // The project matched, but no instance there is on the requested port: a distinct,
    // more actionable failure than "nothing is running here".
    if (targetPort != null && projectMatches.length > 0) {
      return { kind: 'port-mismatch', port: targetPort, projectMatches };
    }
    return { kind: 'no-instance', records };
  }

  return { kind: 'match', matches: selectCompetingBucket(matches, targetPort, currentAgent) };
}

/** Records whose cwd or configDir matches the target project, ignoring MCP status. */
export function listProjectMatches(
  records: StorybookInstanceRecord[],
  target: Pick<ResolveTarget, 'cwd' | 'configDir' | 'configDirExplicit'>
): StorybookInstanceRecord[] {
  const normalisedCwd = resolve(target.cwd);
  const normalisedConfigDir = target.configDir && resolve(target.configDir);
  const matchesConfigDir = (record: StorybookInstanceRecord) =>
    normalisedConfigDir != null &&
    record.configDir != null &&
    resolve(record.configDir) === normalisedConfigDir;
  return target.configDirExplicit
    ? records.filter(matchesConfigDir)
    : records.filter((record) => resolve(record.cwd) === normalisedCwd || matchesConfigDir(record));
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
