import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// prepareRef downloads ~20MB from GitHub; mocked so the suite stays offline.
vi.mock('../agentic-reference/external-repo.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../agentic-reference/external-repo.ts')>()),
  prepareRef: vi.fn(),
}));

import { prepareRef } from '../agentic-reference/external-repo.ts';
import {
  baselinePath,
  loadOrBuildBaselineAnalysis,
  nodeCensusPath,
  readNodeCensus,
  writeNodeCensus,
} from './baseline.ts';

import type { NodeRecord } from '../agentic-reference/metrics/ds-coverage/types.ts';
import type { PostAnalysis } from './types.ts';

const PIN = { repo: 'owner/name', ref: 'deadbeef' };

let root: string;

function options(overrides: Partial<Parameters<typeof loadOrBuildBaselineAnalysis>[0]> = {}) {
  return {
    pin: PIN,
    baselinesDir: join(root, 'baselines'),
    refCacheDir: join(root, 'refs'),
    postAnalysis: {
      analyzeRun: vi.fn(() => ({ files: { 'a.ts': 1 } })),
      summarize: vi.fn(),
    } as unknown as PostAnalysis,
    ...overrides,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'baseline-lib-'));
  vi.mocked(prepareRef).mockReturnValue(join(root, 'ref-tree'));
  // Rebuilds announce themselves; the suite does not need to hear it.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('baselinePath', () => {
  it('keys on the pin alone, escaping separators in both halves', () => {
    expect(baselinePath('/b', { repo: 'owner/name', ref: 'heads/main' })).toBe(
      '/b/owner__name@heads__main.json'
    );
  });
});

describe('loadOrBuildBaselineAnalysis', () => {
  it('builds via analyzeRun in baseline mode and commits the result', async () => {
    const opts = options();
    const built = await loadOrBuildBaselineAnalysis(opts);

    expect(built.analysis).toEqual({ files: { 'a.ts': 1 } });
    expect(built.dir).toBe(join(root, 'ref-tree'));

    const written = JSON.parse(readFileSync(baselinePath(opts.baselinesDir, PIN), 'utf8'));
    expect(written).toEqual({
      repo: 'owner/name',
      ref: 'deadbeef',
      // This module measures no nodes, so there is no census file to demand back.
      nodeCensus: false,
      analysis: { files: { 'a.ts': 1 } },
    });
  });

  it('hands analyzeRun a baseline context of pin and tree only', async () => {
    const opts = options();
    await loadOrBuildBaselineAnalysis(opts);
    expect(opts.postAnalysis.analyzeRun).toHaveBeenCalledWith({
      mode: 'baseline',
      projectDir: join(root, 'ref-tree'),
      pin: PIN,
    });
  });

  it('reads the committed baseline instead of re-measuring the tree', async () => {
    const opts = options();
    const path = baselinePath(opts.baselinesDir, PIN);
    mkdirSync(opts.baselinesDir, { recursive: true });
    writeFileSync(path, JSON.stringify({ ...PIN, analysis: { files: { 'a.ts': 99 } } }));

    const loaded = await loadOrBuildBaselineAnalysis(opts);

    expect(loaded.analysis).toEqual({ files: { 'a.ts': 99 } });
    expect(opts.postAnalysis.analyzeRun).not.toHaveBeenCalled();
  });

  it('reuses a committed baseline whose metricsVersion matches the module', async () => {
    const opts = options({
      postAnalysis: {
        analyzeRun: vi.fn(() => ({ files: { 'a.ts': 1 } })),
        summarize: vi.fn(),
        metricsVersion: 2,
      } as unknown as PostAnalysis,
    });
    const path = baselinePath(opts.baselinesDir, PIN);
    mkdirSync(opts.baselinesDir, { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        ...PIN,
        metricsVersion: 2,
        analysis: { files: { 'a.ts': 99 } },
      })
    );

    const loaded = await loadOrBuildBaselineAnalysis(opts);

    expect(loaded.analysis).toEqual({ files: { 'a.ts': 99 } });
    expect(opts.postAnalysis.analyzeRun).not.toHaveBeenCalled();
  });

  // A stale baseline is worse than a missing one: its numbers look healthy but
  // were measured under other definitions, skewing every delta against it.
  it('rebuilds a committed baseline measured under another metricsVersion', async () => {
    const opts = options({
      postAnalysis: {
        analyzeRun: vi.fn(() => ({ files: { 'a.ts': 1 } })),
        summarize: vi.fn(),
        metricsVersion: 2,
      } as unknown as PostAnalysis,
    });
    const path = baselinePath(opts.baselinesDir, PIN);
    mkdirSync(opts.baselinesDir, { recursive: true });
    // A legacy file, from before the module declared a version.
    writeFileSync(path, JSON.stringify({ ...PIN, analysis: { files: { 'a.ts': 99 } } }));

    const rebuilt = await loadOrBuildBaselineAnalysis(opts);

    expect(rebuilt.analysis).toEqual({ files: { 'a.ts': 1 } });
    // The overwritten file now carries the version it was measured under.
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      repo: 'owner/name',
      ref: 'deadbeef',
      metricsVersion: 2,
      nodeCensus: false,
      analysis: { files: { 'a.ts': 1 } },
    });
  });

  it('re-measures and overwrites the committed baseline when recompute is set', async () => {
    const opts = options({ recompute: true });
    const path = baselinePath(opts.baselinesDir, PIN);
    mkdirSync(opts.baselinesDir, { recursive: true });
    writeFileSync(path, JSON.stringify({ ...PIN, analysis: { files: { 'a.ts': 99 } } }));

    const rebuilt = await loadOrBuildBaselineAnalysis(opts);

    expect(rebuilt.analysis).toEqual({ files: { 'a.ts': 1 } });
    expect(JSON.parse(readFileSync(path, 'utf8')).analysis).toEqual({ files: { 'a.ts': 1 } });
  });

  it('builds once per pin however many runs ask for it', async () => {
    const opts = options();
    await loadOrBuildBaselineAnalysis(opts);
    await loadOrBuildBaselineAnalysis(opts);
    await loadOrBuildBaselineAnalysis(opts);

    expect(opts.postAnalysis.analyzeRun).toHaveBeenCalledTimes(1);
  });

  // --recompute means "measure fresh", not "measure per run": the second and
  // third runs of an eval must reuse the tree measured moments ago.
  it('re-measures a recomputed pin once, not once per run', async () => {
    const opts = options({ recompute: true });
    await loadOrBuildBaselineAnalysis(opts);
    await loadOrBuildBaselineAnalysis(opts);
    await loadOrBuildBaselineAnalysis(opts);

    expect(opts.postAnalysis.analyzeRun).toHaveBeenCalledTimes(1);
  });

  // The pin is now the whole key, so it has to be a discriminating one: two
  // pins sharing a baselinesDir must not read each other's numbers.
  it('keys by pin, so a second pin gets its own file', async () => {
    const other = { repo: 'owner/name', ref: 'cafebabe' };
    const a = options();
    const b = options({
      pin: other,
      baselinesDir: a.baselinesDir,
      postAnalysis: {
        analyzeRun: vi.fn(() => ({ files: { 'b.ts': 2 } })),
        summarize: vi.fn(),
      } as unknown as PostAnalysis,
    });

    await loadOrBuildBaselineAnalysis(a);
    expect((await loadOrBuildBaselineAnalysis(b)).analysis).toEqual({ files: { 'b.ts': 2 } });
    expect(existsSync(baselinePath(a.baselinesDir, PIN))).toBe(true);
    expect(existsSync(baselinePath(a.baselinesDir, other))).toBe(true);
  });

  // postAnalysis is resolved per experiment but the baseline path is not, so
  // two experiments on one pin can disagree about the version. The memo must
  // not hand the second one the first one's numbers behind the version check's
  // back — the whole point of that check is to stop measurements crossing
  // definitions.
  it('does not serve a memoized baseline to a module on another metricsVersion', async () => {
    const dir = join(root, 'baselines');
    const v7 = options({
      baselinesDir: dir,
      postAnalysis: {
        analyzeRun: vi.fn(() => ({ files: { 'a.ts': 7 } })),
        summarize: vi.fn(),
        metricsVersion: 7,
      } as unknown as PostAnalysis,
    });
    const v3 = options({
      baselinesDir: dir,
      postAnalysis: {
        analyzeRun: vi.fn(() => ({ files: { 'a.ts': 3 } })),
        summarize: vi.fn(),
        metricsVersion: 3,
      } as unknown as PostAnalysis,
    });

    await loadOrBuildBaselineAnalysis(v7);
    expect((await loadOrBuildBaselineAnalysis(v3)).analysis).toEqual({ files: { 'a.ts': 3 } });
    expect(v3.postAnalysis.analyzeRun).toHaveBeenCalledTimes(1);
  });

  it('rebuilds rather than trusting a truncated baseline', async () => {
    const opts = options();
    mkdirSync(opts.baselinesDir, { recursive: true });
    writeFileSync(baselinePath(opts.baselinesDir, PIN), '{"analysis": {"fi');

    expect((await loadOrBuildBaselineAnalysis(opts)).analysis).toEqual({ files: { 'a.ts': 1 } });
  });

  it('fails loudly when analyzeRun cannot measure the pinned tree', async () => {
    const opts = options({
      postAnalysis: {
        analyzeRun: vi.fn(() => null),
        summarize: vi.fn(),
      } as unknown as PostAnalysis,
    });

    await expect(loadOrBuildBaselineAnalysis(opts)).rejects.toThrow(/owner\/name@deadbeef/);
    expect(existsSync(baselinePath(opts.baselinesDir, PIN))).toBe(false);
  });
});

// Only `path` matters to a round-trip test; the census's own tests cover the
// full record shape.
const PARTIAL_NODES = [{ path: 'App/A[0]' }] as unknown as NodeRecord[];

/** A module that censuses nodes alongside its analysis, as v7 baselines do. */
function withNodes() {
  return {
    analyzeRun: vi.fn(() => ({ files: {}, nodeList: [{ path: 'App/A[0]' }] })),
    summarize: vi.fn(),
    metricsVersion: 7,
  } as unknown as PostAnalysis;
}

describe('node census file', () => {
  it('writes the census beside the baseline, keyed on the pin', async () => {
    const opts = options({ postAnalysis: withNodes() });
    await loadOrBuildBaselineAnalysis(opts);

    const censusFile = JSON.parse(
      readFileSync(nodeCensusPath(join(root, 'baselines'), PIN), 'utf8')
    ) as Record<string, unknown>;
    expect(censusFile).toMatchObject({
      repo: PIN.repo,
      ref: PIN.ref,
      metricsVersion: 7,
      nodes: [{ path: 'App/A[0]' }],
    });
  });

  // The census file is the judge's baseline half; keeping it out of the committed
  // baseline is what keeps that file reviewable.
  it('keeps the node list out of the committed baseline', async () => {
    const opts = options({ postAnalysis: withNodes() });
    const built = await loadOrBuildBaselineAnalysis(opts);

    const committed = JSON.parse(
      readFileSync(baselinePath(join(root, 'baselines'), PIN), 'utf8')
    ) as { analysis: Record<string, unknown> };
    expect('nodeList' in committed.analysis).toBe(false);
    // And the in-memory value callers get is the same one, not the fuller
    // object it was split from.
    expect('nodeList' in built.analysis).toBe(false);
  });

  it('reads back what it wrote', () => {
    const dir = join(root, 'baselines');
    writeNodeCensus(dir, PIN, 7, PARTIAL_NODES);
    expect(readNodeCensus(dir, PIN, 7)).toEqual([{ path: 'App/A[0]' }]);
  });

  // A census file measured under other rules is worse than none: its numbers look
  // healthy and mean something else.
  it('treats a version mismatch as absent', () => {
    const dir = join(root, 'baselines');
    writeNodeCensus(dir, PIN, 6, PARTIAL_NODES);
    expect(readNodeCensus(dir, PIN, 7)).toBeNull();
  });

  it('treats an absent census file as null rather than throwing', () => {
    expect(readNodeCensus(join(root, 'baselines'), PIN, 7)).toBeNull();
  });

  // Absent on both sides is a match, which is what keeps a module that never
  // declares a version on the same terms as the committed baseline beside it.
  it('matches a versionless census file against a versionless module', () => {
    const dir = join(root, 'baselines');
    writeNodeCensus(dir, PIN, undefined, PARTIAL_NODES);
    expect(readNodeCensus(dir, PIN, undefined)).toEqual([{ path: 'App/A[0]' }]);
    // And a versioned module still refuses it.
    expect(readNodeCensus(dir, PIN, 7)).toBeNull();
  });

  it('treats a census file whose nodes are not a list as absent', () => {
    const dir = join(root, 'baselines');
    const path = nodeCensusPath(dir, PIN);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ ...PIN, metricsVersion: 7, nodes: 'lots' }));

    expect(readNodeCensus(dir, PIN, 7)).toBeNull();
  });

  /** Commit a baseline by hand, as a checkout would arrive with one. */
  function commitBaseline(dir: string, extra: Record<string, unknown>) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      baselinePath(dir, PIN),
      JSON.stringify({ ...PIN, metricsVersion: 7, analysis: { files: { 'a.ts': 99 } }, ...extra })
    );
  }

  // Half a pair on disk is permanent without this: only a rebuild writes a
  // census file, and a current-looking baseline is what suppresses the rebuild.
  it('rebuilds a current baseline whose census file was never committed', async () => {
    const opts = options({ postAnalysis: withNodes() });
    commitBaseline(opts.baselinesDir, { nodeCensus: true });

    const rebuilt = await loadOrBuildBaselineAnalysis(opts);

    expect(rebuilt.analysis).toEqual({ files: {} });
    expect(existsSync(nodeCensusPath(opts.baselinesDir, PIN))).toBe(true);
  });

  it('leaves an intact pair alone', async () => {
    const opts = options({ postAnalysis: withNodes() });
    commitBaseline(opts.baselinesDir, { nodeCensus: true });
    writeNodeCensus(opts.baselinesDir, PIN, 7, PARTIAL_NODES);

    const loaded = await loadOrBuildBaselineAnalysis(opts);

    expect(loaded.analysis).toEqual({ files: { 'a.ts': 99 } });
    expect(opts.postAnalysis.analyzeRun).not.toHaveBeenCalled();
  });

  // The mirror case: a module measuring no nodes never wrote a census file, so
  // demanding one back would re-measure the tree on every process and defeat
  // the point of committing baselines at all.
  it('still hits the cache for a baseline that never had a census file', async () => {
    const opts = options();
    await loadOrBuildBaselineAnalysis(opts);
    expect(existsSync(nodeCensusPath(opts.baselinesDir, PIN))).toBe(false);

    const second = options({ baselinesDir: opts.baselinesDir });
    await loadOrBuildBaselineAnalysis(second);

    expect(second.postAnalysis.analyzeRun).not.toHaveBeenCalled();
  });
});
