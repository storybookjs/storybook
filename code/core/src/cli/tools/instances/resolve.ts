import {
  CLAUDE_AGENT_NAME,
  CLAUDE_PREVIEW_AGENT_NAME,
} from '../../../shared/constants/agent-provenance.ts';
import { projectPathsEqual } from './project-path.ts';
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
  /** Port of a running Storybook; a known port targets that instance without cwd or config dir. */
  port?: number;
  /** The invoking agent (std-env name), used to pick among competing matches. */
  agent?: string;
};

/**
 * Pick the Storybook instance that matches the target project. With an explicit `--config-dir`
 * (`configDirExplicit`), only records whose recorded `configDir` equals `target.configDir` match.
 * Otherwise a record matches when its recorded `cwd` equals `target.cwd` OR its recorded
 * `configDir` equals the defaulted `target.configDir`. All comparisons use resolved paths
 * (case-insensitive on Windows, byte-exact on POSIX) with no longest-prefix or fallback
 * behaviour (milestone 2 of storybookjs/storybook#34826). The
 * configDir key exists for monorepos (storybookjs/storybook#35359): a dev server started at the
 * repo root with `-c packages/ui/.storybook` must be found by a CLI run from `packages/ui`, and
 * vice versa. Records from older Storybooks carry no `configDir` and can only match by cwd — so
 * an explicit `--config-dir` cannot select them, and the no-instance guidance offers their
 * `--cwd` instead.
 *
 * When `target.port` is supplied (e.g. an agent that launched Storybook on a known port and wants
 * to address that exact instance), the port alone is the address: records match on port across
 * all projects, and the record supplies the project the caller would otherwise pass as
 * `--cwd`/`--config-dir` (see {@link selectInstances}). If no instance is on the port, a
 * `port-mismatch` intercept is returned with the running instances as candidates so callers can
 * surface the running ports.
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
      records: selection.candidates,
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
  | {
      kind: 'port-mismatch';
      port: number;
      /** The instances the port was matched against, so callers can list the running ports. */
      candidates: StorybookInstanceRecord[];
    };

/**
 * The selection half of {@link resolveInstance}: instance matching, ordering, and the port
 * targeting dimension. MCP status plays no role — the attach path consumes this directly because
 * attaching over the channel works without `@storybook/addon-mcp`.
 *
 * An explicit port is a complete address on its own: one process owns a port, and its record
 * already carries the project (cwd, config dir) the caller would otherwise supply. So with
 * `target.port`, records match on port across all projects — the caller's cwd plays no role — and
 * an explicit `--config-dir` still restricts the candidates, keeping its precise-intent contract.
 * No instance on the port → `port-mismatch` with the candidates, so callers can list what runs
 * (`no-instance` when nothing is running at all).
 */
export function selectInstances(
  records: StorybookInstanceRecord[],
  target: ResolveTarget
): InstanceSelection {
  const { port: targetPort, agent: currentAgent } = target;

  if (targetPort != null) {
    const candidates = target.configDirExplicit
      ? records.filter((record) => matchesTargetConfigDir(record, target))
      : records;
    const matches = candidates.filter((record) => record.port === targetPort);
    if (matches.length === 0) {
      return candidates.length > 0
        ? { kind: 'port-mismatch', port: targetPort, candidates }
        : { kind: 'no-instance', records };
    }
    return { kind: 'match', matches: [...matches].sort(byMostRecentlyStarted) };
  }

  const projectMatches = listProjectMatches(records, target);
  if (projectMatches.length === 0) {
    return { kind: 'no-instance', records };
  }
  return { kind: 'match', matches: selectCompetingBucket(projectMatches, currentAgent) };
}

/** Records whose cwd or configDir matches the target project, ignoring MCP status. */
export function listProjectMatches(
  records: StorybookInstanceRecord[],
  target: Pick<ResolveTarget, 'cwd' | 'configDir' | 'configDirExplicit'>
): StorybookInstanceRecord[] {
  return target.configDirExplicit
    ? records.filter((record) => matchesTargetConfigDir(record, target))
    : records.filter(
        (record) =>
          projectPathsEqual(record.cwd, target.cwd) || matchesTargetConfigDir(record, target)
      );
}

function matchesTargetConfigDir(
  record: StorybookInstanceRecord,
  target: Pick<ResolveTarget, 'configDir'>
): boolean {
  return (
    target.configDir != null &&
    record.configDir != null &&
    projectPathsEqual(record.configDir, target.configDir)
  );
}

function selectCompetingBucket(
  matches: StorybookInstanceRecord[],
  currentAgent: string | undefined
) {
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
