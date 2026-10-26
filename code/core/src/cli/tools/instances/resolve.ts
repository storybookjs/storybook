import {
  CLAUDE_AGENT_NAME,
  CLAUDE_PREVIEW_AGENT_NAME,
} from '../../../shared/constants/agent-provenance.ts';
import { projectPathsEqual } from './project-path.ts';
import type { StorybookInstanceRecord } from './types.ts';

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

// Paths are compared resolved and exact (case-insensitive on Windows, byte-exact on POSIX), never
// by prefix. A record matches when its cwd equals `target.cwd` or its configDir equals
// `target.configDir`, so a dev server started at a monorepo root with `-c packages/ui/.storybook`
// is found from `packages/ui` and vice versa. An explicit `--config-dir` matches on configDir
// only, which records from older Storybooks lack.
//
// `target.port` is a complete address: records match on port across all projects, still
// restricted by an explicit `--config-dir`. Nothing on the port → `port-mismatch`.
//
// Competing matches narrow to the invoking agent's bucket when one exists. MCP status plays no
// role: attaching over the channel works without `@storybook/addon-mcp`.
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
