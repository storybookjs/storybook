// Measure the pristine tree a pin's runs are compared against, once per pin.
//
// The "before" side of any delta only changes when the pin moves, so measuring
// it per run is wasted work for both deterministic and LLM-based metrics.
//
// Pins are references on a repo. This lets us make non-breaking changes to pinned
// repos and moving the ref to their new branch head if needed.
//
// Pinned baselines are shared for *all* agentic reference evals. If you need to
// pin different metrics based on the eval or MCP being used in an experiment,
// you will need to make pins more specific again, at the expense of cache reuse.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { pinSlug, prepareRef, type ExternalRepoPin } from '../agentic-reference/external-repo.ts';
import { readJson } from '../utils/files.ts';

import type { NodeRecord } from '../agentic-reference/metrics/ds-coverage/types.ts';
import type { Analysis, PostAnalysis } from './types.ts';

const DEFAULT_BASELINES_DIR = new URL('../../baselines', import.meta.url).pathname;
const DEFAULT_REF_CACHE_DIR = new URL('../../.eval-cache/refs', import.meta.url).pathname;

/** What a committed baseline file holds. `analysis` is opaque to this module. */
interface CommittedBaseline {
  repo: string;
  ref: string;
  /** The eval's metricsVersion at measuring time; absent for legacy files. */
  metricsVersion?: number;
  /**
   * Whether a node census file was written beside this file. Recorded rather than
   * inferred because the two legitimate reasons for a missing census file have to
   * be told apart: a module that measures no nodes (or a pin declaring no
   * design system) never writes one and must still hit the cache, while a
   * baseline that had one and lost it has to be rebuilt. Absent for legacy
   * files, which counts as "never had one".
   */
  nodeCensus?: boolean;
  analysis: Analysis;
}

export interface BaselineAnalysis {
  /** Absolute path to the pin's materialized tree. */
  dir: string;
  /** What the eval's analyzeRun returned for that tree. */
  analysis: Analysis;
}

export interface BaselineOptions {
  pin: ExternalRepoPin;
  postAnalysis: PostAnalysis;
  /** Re-measure the pinned tree and overwrite the committed baseline. */
  recompute?: boolean;
  /** Overridable for testing. */
  baselinesDir?: string;
  /** Overridable for testing. */
  refCacheDir?: string;
}

/**
 * Both halves of the pin have their separators escaped, so each stays a single
 * path segment: a ref like `heads/main` would otherwise turn the filename into
 * a nested path.
 */
export function baselinePath(baselinesDir: string, pin: ExternalRepoPin): string {
  return join(baselinesDir, `${pinSlug(pin)}.json`);
}

/** Where the whole-tree node census for a pin lives. */
const NODE_CENSUS_DIR = 'ds-nodes';

interface CommittedNodeCensus {
  repo: string;
  ref: string;
  metricsVersion?: number;
  nodes: NodeRecord[];
}

/**
 * The census file for a pin, under its own directory so `ls baselines/` still shows
 * one file per pin. Same slug as the baseline, so the pair is obvious on disk.
 */
export function nodeCensusPath(baselinesDir: string, pin: ExternalRepoPin): string {
  return join(baselinesDir, NODE_CENSUS_DIR, `${pinSlug(pin)}.json`);
}

/** Commit a pin's node census, overwriting any census file already there. */
export function writeNodeCensus(
  baselinesDir: string,
  pin: ExternalRepoPin,
  metricsVersion: number | undefined,
  nodes: NodeRecord[]
): void {
  const path = nodeCensusPath(baselinesDir, pin);
  mkdirSync(dirname(path), { recursive: true });
  const payload: CommittedNodeCensus = { repo: pin.repo, ref: pin.ref, metricsVersion, nodes };
  // Tab-indented for the same reason the baseline is, and needing `yarn fmt:write`
  // afterwards for the same reason too — more urgently here: JSON.stringify puts
  // every array element on its own line, oxfmt collapses short ones, and every
  // NodeRecord carries a `props` array. Committing a generated census file without
  // formatting it first fails `format:check` on essentially every record.
  writeFileSync(path, JSON.stringify(payload, null, '\t') + '\n');
}

/**
 * The pin's node census, or null when absent or measured under other rules.
 * A census file from another metricsVersion is worse than none: its records look
 * healthy and were built by a different path format.
 */
export function readNodeCensus(
  baselinesDir: string,
  pin: ExternalRepoPin,
  metricsVersion: number | undefined
): NodeRecord[] | null {
  const stored = readJson<CommittedNodeCensus>(nodeCensusPath(baselinesDir, pin));
  if (!stored || !Array.isArray(stored.nodes) || stored.metricsVersion !== metricsVersion) {
    return null;
  }
  return stored.nodes;
}

// Keyed by the resolved file path rather than the pin, so a caller pointed at
// a different baselinesDir gets its own entry — and by metricsVersion too, since
// postAnalysis is resolved per experiment while the path is not. Two experiments
// on one pin whose modules disagree on the version must not read each other's
// numbers: without the version in the key the second one takes a memo hit and
// never reaches the comparison below that exists to stop exactly that.
const memo = new Map<string, BaselineAnalysis>();

// Baselines already re-measured by this process, same key. `--recompute` must
// rebuild a baseline once, not once per run: without this, every run of a
// ten-run eval re-measures the whole pinned tree, and the recompute pass crawls.
const recomputedKeys = new Set<string>();

/** The memo identity of a baseline: which file, measured under which rules. */
function memoKeyFor(path: string, metricsVersion: number | undefined): string {
  return `${path}#${metricsVersion ?? 'none'}`;
}

export async function loadOrBuildBaselineAnalysis(
  options: BaselineOptions
): Promise<BaselineAnalysis> {
  const { pin, postAnalysis, recompute = false } = options;
  const baselinesDir = options.baselinesDir ?? DEFAULT_BASELINES_DIR;
  const path = baselinePath(baselinesDir, pin);
  const memoKey = memoKeyFor(path, postAnalysis.metricsVersion);

  // Anything in the memo already passed the checks below, so a hit cannot
  // smuggle a stale version or a half-committed pair past them.
  const remembered = memo.get(memoKey);
  if (remembered && (!recompute || recomputedKeys.has(memoKey))) return remembered;

  // The tree itself is materialized either way: a committed baseline saves the
  // measuring, not the download, and a delta metric comparing file contents
  // needs both sides on disk.
  const dir = prepareRef(options.refCacheDir ?? DEFAULT_REF_CACHE_DIR, pin.repo, pin.ref);

  // A truncated baseline is worse than none, and readJson nulls one out. One
  // measured under another metricsVersion is worse still — its numbers look
  // healthy and mean something else — so a version mismatch is a cache miss:
  // the tree is already materialized above, and the rebuild below overwrites
  // the stale file with numbers measured under the current definitions.
  const committed = recompute ? null : readJson<CommittedBaseline>(path);
  const versionMatches =
    committed?.analysis !== undefined && committed.metricsVersion === postAnalysis.metricsVersion;
  // A baseline that recorded a census file and no longer has one beside it is a
  // cache miss too. Nothing else would ever write the missing half: the pair is
  // only produced by a rebuild, and a current-looking baseline suppresses one
  // forever. Rebuilding is what makes "written together and only together" true
  // of the files on disk rather than just of this function.
  const censusIntact =
    committed?.nodeCensus !== true ||
    readNodeCensus(baselinesDir, pin, postAnalysis.metricsVersion) !== null;
  if (versionMatches && censusIntact) {
    const loaded = { dir, analysis: committed.analysis };
    memo.set(memoKey, loaded);
    return loaded;
  }

  // Say why the tree is being measured: on a large tree a silent rebuild
  // reads as a hang, and "did --recompute touch the baselines?" should be
  // answerable from the output alone.
  const reason = recompute
    ? 'recompute'
    : !committed?.analysis
      ? 'no committed baseline'
      : versionMatches
        ? 'node census file missing'
        : `metricsVersion ${committed.metricsVersion ?? 'none'} -> ${postAnalysis.metricsVersion ?? 'none'}`;
  console.log(`Measuring baseline for ${pin.repo}@${pin.ref} (${reason})`);

  const analysis = await postAnalysis.analyzeRun({ mode: 'baseline', projectDir: dir, pin });
  if (analysis === null) {
    throw new Error(
      `analyzeRun returned no baseline for ${pin.repo}@${pin.ref}; ` +
        'a postAnalysis providing deltaToBaseline must measure its pinned tree.'
    );
  }

  // The node list rides out to its own file: the committed baseline is meant to
  // stay readable in a diff, and thousands of records would end that. Guarded
  // with Array.isArray rather than a presence check, because this is the one
  // place the module looks inside an analysis it otherwise treats as opaque —
  // the same guard readNodeCensus applies at the other end.
  const { nodeList, ...analysisWithoutNodes } = analysis as Analysis & {
    nodeList?: unknown;
  };
  const hasNodeCensus = Array.isArray(nodeList);
  if (hasNodeCensus) {
    writeNodeCensus(baselinesDir, pin, postAnalysis.metricsVersion, nodeList as NodeRecord[]);
  }

  mkdirSync(dirname(path), { recursive: true });
  // JSON.stringify drops an undefined metricsVersion, keeping legacy modules'
  // files byte-identical to what they wrote before the field existed.
  const payload: CommittedBaseline = {
    repo: pin.repo,
    ref: pin.ref,
    metricsVersion: postAnalysis.metricsVersion,
    nodeCensus: hasNodeCensus,
    analysis: analysisWithoutNodes,
  };
  // Tab-indented because the file is committed, and `yarn fmt:check` would
  // otherwise fail on it the moment --recompute regenerates it. The match is
  // close but not exact — JSON.stringify always expands an array the formatter
  // would keep on one line — so run `yarn fmt:write` after a rebuild.
  writeFileSync(path, JSON.stringify(payload, null, '\t') + '\n');

  const built = { dir, analysis: analysisWithoutNodes };
  memo.set(memoKey, built);
  if (recompute) recomputedKeys.add(memoKey);
  return built;
}
