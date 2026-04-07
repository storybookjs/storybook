/**
 * SPIKE: Feature extraction timing
 *
 * Purpose: Measure how long it takes to AST-parse every story file in a project
 * and extract feature-adoption metrics (decorators, loaders, layout, viewports, etc).
 *
 * This is throwaway code used to inform a planning decision (full extraction vs sampling).
 * Delete this file once the architecture is locked in.
 *
 * Usage:
 *   node scripts/spike-extract-features.ts [targetDir] [--quiet]
 *
 * Examples:
 *   node scripts/spike-extract-features.ts ./code
 *   node scripts/spike-extract-features.ts ../storybook-sandboxes/react-vite-default-ts
 */

import { glob, readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve, sep } from 'node:path';
import { argv } from 'node:process';

import { loadCsf } from 'storybook/internal/csf-tools';
import { types as t, traverse } from 'storybook/internal/babel';

const IGNORE_SEGMENTS = ['node_modules', 'dist', 'build', 'storybook-static', '.cache'];
const STORY_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts']);

async function findStoryFiles(cwd: string): Promise<string[]> {
  const matches: string[] = [];
  for await (const entry of glob('**/*.stories.*', { cwd })) {
    const parts = entry.split(sep);
    if (parts.some((p) => IGNORE_SEGMENTS.includes(p))) continue;
    const ext = entry.slice(entry.lastIndexOf('.') + 1);
    if (!STORY_EXTENSIONS.has(ext)) continue;
    matches.push(resolve(cwd, entry));
  }
  return matches;
}

type CsfMinimal = {
  _metaAnnotations?: Record<string, unknown>;
  _storyAnnotations?: Record<string, Record<string, unknown>>;
  _stories?: Record<string, { __stats?: Record<string, unknown> }>;
  _storyPaths?: Record<string, { node?: { start?: number; end?: number } }>;
  _ast?: unknown;
  imports?: unknown[];
};

type FileResult = {
  file: string;
  ok: boolean;
  error?: string;
  readMs: number;
  parseMs: number;
  extractMs: number;
  totalMs: number;
  bytes: number;
  storyCount: number;
  features?: ExtractedFeatures;
};

type ExtractedFeatures = {
  meta: {
    annotationKeys: string[];
    decoratorCount: number;
    loaderCount: number;
    parametersKeys: string[];
    argTypesKeys: number;
    hasGlobals: boolean;
    hasTags: boolean;
    hasRender: boolean;
  };
  storyCount: number;
  storiesWithCustomDecorators: number;
  storiesWithCustomLoaders: number;
  storiesWithCustomArgTypes: number;
  storiesWithCustomParameters: number;
  storiesWithCustomTags: number;
  storiesWithPlay: number;
  storiesWithRender: number;
  storiesWithCustomGlobals: number;
  storiesWithCustomLayout: number;
  storiesWithCustomViewport: number;
  storiesWithCustomActions: number;
  importsAction: boolean;
  importsFn: boolean;
  storiesUsingFnText: number;
  storiesUsingActionText: number;
  legacyStats: Record<string, number>;
};

function countArrayLiteral(node: unknown): number {
  if (node && t.isArrayExpression(node as never)) {
    return (node as { elements?: unknown[] }).elements?.length ?? -1;
  }
  return -1;
}

function objectLiteralKeys(node: unknown): string[] {
  if (!node || !t.isObjectExpression(node as never)) {
    return [];
  }
  const keys: string[] = [];
  const props = (node as { properties?: unknown[] }).properties ?? [];
  for (const prop of props) {
    if (t.isObjectProperty(prop as never)) {
      const key = (prop as { key: unknown }).key;
      if (t.isIdentifier(key as never)) {
        keys.push((key as { name: string }).name);
      }
    } else if (t.isObjectMethod(prop as never)) {
      const key = (prop as { key: unknown }).key;
      if (t.isIdentifier(key as never)) {
        keys.push((key as { name: string }).name);
      }
    }
  }
  return keys;
}

function extractFeatures(csf: CsfMinimal, code: string): ExtractedFeatures {
  const metaAnn: Record<string, unknown> = csf._metaAnnotations || {};
  const storyAnn: Record<string, Record<string, unknown>> = csf._storyAnnotations || {};

  const metaParametersKeys = objectLiteralKeys(metaAnn.parameters);
  const metaDecorators = metaAnn.decorators;
  const metaLoaders = metaAnn.loaders;
  const metaArgTypes = metaAnn.argTypes;

  let importsAction = false;
  let importsFn = false;

  try {
    const ast = csf._ast;
    if (ast) {
      traverse(ast as never, {
        ImportDeclaration(path: { node: { source: { value: string }; specifiers: unknown[] } }) {
          const source = path.node.source.value;
          if (
            source === 'storybook/actions' ||
            source === 'storybook/test' ||
            source === '@storybook/test' ||
            source === '@storybook/addon-actions'
          ) {
            for (const spec of path.node.specifiers) {
              if (t.isImportSpecifier(spec as never)) {
                const imported = (spec as { imported: unknown }).imported;
                if (t.isIdentifier(imported as never)) {
                  const name = (imported as { name: string }).name;
                  if (name === 'action') importsAction = true;
                  if (name === 'fn') importsFn = true;
                }
              }
            }
          }
        },
      });
    }
  } catch {
    // best effort
  }

  let storiesWithCustomDecorators = 0;
  let storiesWithCustomLoaders = 0;
  let storiesWithCustomArgTypes = 0;
  let storiesWithCustomParameters = 0;
  let storiesWithCustomTags = 0;
  let storiesWithPlay = 0;
  let storiesWithRender = 0;
  let storiesWithCustomGlobals = 0;
  let storiesWithCustomLayout = 0;
  let storiesWithCustomViewport = 0;
  let storiesWithCustomActions = 0;
  let storiesUsingFnText = 0;
  let storiesUsingActionText = 0;

  const storyKeys = Object.keys(csf._stories || {});
  for (const key of storyKeys) {
    const ann = storyAnn[key] || {};
    if (ann.decorators) storiesWithCustomDecorators++;
    if (ann.loaders) storiesWithCustomLoaders++;
    if (ann.argTypes) storiesWithCustomArgTypes++;
    if (ann.parameters) storiesWithCustomParameters++;
    if (ann.tags) storiesWithCustomTags++;
    if (ann.play) storiesWithPlay++;
    if (ann.render) storiesWithRender++;
    if (ann.globals) storiesWithCustomGlobals++;
    if (ann.parameters && t.isObjectExpression(ann.parameters as never)) {
      const keys = objectLiteralKeys(ann.parameters);
      if (keys.includes('layout')) storiesWithCustomLayout++;
      if (keys.includes('viewport')) storiesWithCustomViewport++;
      if (keys.includes('actions')) storiesWithCustomActions++;
    }

    try {
      const stmtPath = csf._storyPaths?.[key];
      const start = stmtPath?.node?.start;
      const end = stmtPath?.node?.end;
      if (start != null && end != null) {
        const slice = code.slice(start, end);
        if (importsFn && /\bfn\s*\(/.test(slice)) storiesUsingFnText++;
        if (importsAction && /\baction\s*\(/.test(slice)) storiesUsingActionText++;
      }
    } catch {
      // ignore
    }
  }

  const legacyStats: Record<string, number> = {};
  for (const key of storyKeys) {
    const stats = (csf._stories?.[key]?.__stats || {}) as Record<string, unknown>;
    for (const [statKey, statVal] of Object.entries(stats)) {
      if (typeof statVal === 'boolean') {
        legacyStats[statKey] = (legacyStats[statKey] || 0) + (statVal ? 1 : 0);
      }
    }
  }

  return {
    meta: {
      annotationKeys: Object.keys(metaAnn),
      decoratorCount: countArrayLiteral(metaDecorators),
      loaderCount: countArrayLiteral(metaLoaders),
      parametersKeys: metaParametersKeys,
      argTypesKeys: metaArgTypes ? objectLiteralKeys(metaArgTypes).length : -1,
      hasGlobals: !!metaAnn.globals,
      hasTags: !!metaAnn.tags,
      hasRender: !!metaAnn.render,
    },
    storyCount: storyKeys.length,
    storiesWithCustomDecorators,
    storiesWithCustomLoaders,
    storiesWithCustomArgTypes,
    storiesWithCustomParameters,
    storiesWithCustomTags,
    storiesWithPlay,
    storiesWithRender,
    storiesWithCustomGlobals,
    storiesWithCustomLayout,
    storiesWithCustomViewport,
    storiesWithCustomActions,
    importsAction,
    importsFn,
    storiesUsingFnText,
    storiesUsingActionText,
    legacyStats,
  };
}

async function processFile(file: string): Promise<FileResult> {
  const t0 = performance.now();
  let bytes = 0;
  let code = '';
  try {
    code = await readFile(file, 'utf-8');
    bytes = Buffer.byteLength(code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      file,
      ok: false,
      error: `read error: ${msg}`,
      readMs: 0,
      parseMs: 0,
      extractMs: 0,
      totalMs: performance.now() - t0,
      bytes: 0,
      storyCount: 0,
    };
  }
  const t1 = performance.now();
  const readMs = t1 - t0;

  let csf: CsfMinimal;
  try {
    csf = loadCsf(code, {
      fileName: file,
      makeTitle: (s?: string) => s || 'Untitled',
    }).parse() as unknown as CsfMinimal;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      file,
      ok: false,
      error: `parse error: ${msg}`,
      readMs,
      parseMs: performance.now() - t1,
      extractMs: 0,
      totalMs: performance.now() - t0,
      bytes,
      storyCount: 0,
    };
  }
  const t2 = performance.now();
  const parseMs = t2 - t1;

  let features: ExtractedFeatures | undefined;
  try {
    features = extractFeatures(csf, code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      file,
      ok: false,
      error: `extract error: ${msg}`,
      readMs,
      parseMs,
      extractMs: performance.now() - t2,
      totalMs: performance.now() - t0,
      bytes,
      storyCount: Object.keys(csf?._stories ?? {}).length,
    };
  }
  const t3 = performance.now();
  const extractMs = t3 - t2;

  return {
    file,
    ok: true,
    readMs,
    parseMs,
    extractMs,
    totalMs: t3 - t0,
    bytes,
    storyCount: features.storyCount,
    features,
  };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

function summarizeTimings(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    sum: sorted.reduce((a, b) => a + b, 0),
    min: sorted[0] ?? 0,
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

async function main() {
  const args = argv.slice(2);
  const targetDir = resolve(args[0] ?? './code');
  const quiet = args.includes('--quiet');

  console.log(`\n=== Feature Extraction Spike ===`);
  console.log(`Target: ${targetDir}\n`);

  const memBefore = process.memoryUsage();

  const globStart = performance.now();
  const files = await findStoryFiles(targetDir);
  const globMs = performance.now() - globStart;

  console.log(`Glob: found ${files.length} story files in ${fmt(globMs)}ms`);
  if (files.length === 0) {
    console.log('No story files found, exiting');
    return;
  }

  const trials: { totalMs: number; results: FileResult[] }[] = [];
  const TRIALS = 3;
  for (let trial = 0; trial < TRIALS; trial++) {
    const trialStart = performance.now();
    const results: FileResult[] = [];
    for (const f of files) {
      results.push(await processFile(f));
    }
    const trialMs = performance.now() - trialStart;
    trials.push({ totalMs: trialMs, results });
    if (!quiet) {
      console.log(`Trial ${trial + 1}: ${fmt(trialMs)}ms`);
    }
  }

  trials.sort((a, b) => a.totalMs - b.totalMs);
  const best = trials[0];
  const ok = best.results.filter((r) => r.ok);
  const failed = best.results.filter((r) => !r.ok);

  const totalSummary = summarizeTimings(ok.map((r) => r.totalMs));
  const parseSummary = summarizeTimings(ok.map((r) => r.parseMs));
  const extractSummary = summarizeTimings(ok.map((r) => r.extractMs));
  const readSummary = summarizeTimings(ok.map((r) => r.readMs));
  const sizeSummary = summarizeTimings(ok.map((r) => r.bytes));
  const storySummary = summarizeTimings(ok.map((r) => r.storyCount));

  const memAfter = process.memoryUsage();

  console.log(`\n--- Best of ${TRIALS} trials ---`);
  console.log(`Total wall time: ${fmt(best.totalMs)}ms`);
  console.log(`Files parsed OK: ${ok.length}/${files.length}`);
  console.log(`Files failed:    ${failed.length}/${files.length}`);

  const memDelta = (memAfter.rss - memBefore.rss) / 1024 / 1024;
  const memHeap = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
  console.log(`Memory delta: rss ${fmt(memDelta)} MiB, heap ${fmt(memHeap)} MiB`);

  console.log(`\n--- Per-file timings (ms) ---`);
  console.log(
    `total:   sum=${fmt(totalSummary.sum)}  p50=${fmt(totalSummary.p50)}  p95=${fmt(
      totalSummary.p95
    )}  p99=${fmt(totalSummary.p99)}  max=${fmt(totalSummary.max)}`
  );
  console.log(
    `read:    sum=${fmt(readSummary.sum)}  p50=${fmt(readSummary.p50)}  p95=${fmt(
      readSummary.p95
    )}  max=${fmt(readSummary.max)}`
  );
  console.log(
    `parse:   sum=${fmt(parseSummary.sum)}  p50=${fmt(parseSummary.p50)}  p95=${fmt(
      parseSummary.p95
    )}  p99=${fmt(parseSummary.p99)}  max=${fmt(parseSummary.max)}`
  );
  console.log(
    `extract: sum=${fmt(extractSummary.sum)}  p50=${fmt(extractSummary.p50)}  p95=${fmt(
      extractSummary.p95
    )}  max=${fmt(extractSummary.max)}`
  );
  console.log(
    `bytes:   p50=${fmt(sizeSummary.p50, 0)}  p95=${fmt(sizeSummary.p95, 0)}  max=${fmt(
      sizeSummary.max,
      0
    )}`
  );
  console.log(
    `stories: total=${fmt(storySummary.sum, 0)}  p50=${fmt(storySummary.p50, 0)}  max=${fmt(
      storySummary.max,
      0
    )}`
  );

  const agg = {
    files: 0,
    storyCount: 0,
    storiesWithCustomDecorators: 0,
    storiesWithCustomLoaders: 0,
    storiesWithCustomArgTypes: 0,
    storiesWithCustomParameters: 0,
    storiesWithCustomTags: 0,
    storiesWithPlay: 0,
    storiesWithRender: 0,
    storiesWithCustomGlobals: 0,
    storiesWithCustomLayout: 0,
    storiesWithCustomViewport: 0,
    storiesWithCustomActions: 0,
    storiesUsingFnText: 0,
    storiesUsingActionText: 0,
    filesImportingAction: 0,
    filesImportingFn: 0,
    metasWithDecorators: 0,
    metasWithLoaders: 0,
    metasWithArgTypes: 0,
    metasWithParameters: 0,
    metasWithGlobals: 0,
    metasWithTags: 0,
    metasWithRender: 0,
    sumMetaDecorators: 0,
    sumMetaLoaders: 0,
    legacyStats: {} as Record<string, number>,
  };
  for (const r of ok) {
    if (!r.features) continue;
    agg.files++;
    agg.storyCount += r.features.storyCount;
    agg.storiesWithCustomDecorators += r.features.storiesWithCustomDecorators;
    agg.storiesWithCustomLoaders += r.features.storiesWithCustomLoaders;
    agg.storiesWithCustomArgTypes += r.features.storiesWithCustomArgTypes;
    agg.storiesWithCustomParameters += r.features.storiesWithCustomParameters;
    agg.storiesWithCustomTags += r.features.storiesWithCustomTags;
    agg.storiesWithPlay += r.features.storiesWithPlay;
    agg.storiesWithRender += r.features.storiesWithRender;
    agg.storiesWithCustomGlobals += r.features.storiesWithCustomGlobals;
    agg.storiesWithCustomLayout += r.features.storiesWithCustomLayout;
    agg.storiesWithCustomViewport += r.features.storiesWithCustomViewport;
    agg.storiesWithCustomActions += r.features.storiesWithCustomActions;
    agg.storiesUsingFnText += r.features.storiesUsingFnText;
    agg.storiesUsingActionText += r.features.storiesUsingActionText;
    if (r.features.importsAction) agg.filesImportingAction++;
    if (r.features.importsFn) agg.filesImportingFn++;
    if (r.features.meta.annotationKeys.includes('decorators')) agg.metasWithDecorators++;
    if (r.features.meta.annotationKeys.includes('loaders')) agg.metasWithLoaders++;
    if (r.features.meta.annotationKeys.includes('argTypes')) agg.metasWithArgTypes++;
    if (r.features.meta.annotationKeys.includes('parameters')) agg.metasWithParameters++;
    if (r.features.meta.hasGlobals) agg.metasWithGlobals++;
    if (r.features.meta.hasTags) agg.metasWithTags++;
    if (r.features.meta.hasRender) agg.metasWithRender++;
    if (r.features.meta.decoratorCount > 0) agg.sumMetaDecorators += r.features.meta.decoratorCount;
    if (r.features.meta.loaderCount > 0) agg.sumMetaLoaders += r.features.meta.loaderCount;
    for (const [k, v] of Object.entries(r.features.legacyStats)) {
      agg.legacyStats[k] = (agg.legacyStats[k] || 0) + v;
    }
  }

  console.log(`\n--- Aggregated features (best trial) ---`);
  console.log(JSON.stringify(agg, null, 2));

  if (failed.length > 0) {
    console.log(`\n--- Failures (showing first 5) ---`);
    for (const f of failed.slice(0, 5)) {
      console.log(`  ${f.file}: ${f.error}`);
    }
  }

  const slowest = [...ok].sort((a, b) => b.totalMs - a.totalMs).slice(0, 5);
  console.log(`\n--- 5 slowest files ---`);
  for (const r of slowest) {
    console.log(
      `  ${fmt(r.totalMs)}ms (parse=${fmt(r.parseMs)}ms, extract=${fmt(r.extractMs)}ms, ${fmt(
        r.bytes / 1024,
        1
      )}KiB, ${r.storyCount} stories) ${r.file.replace(targetDir, '.')}`
    );
  }

  console.log(`\nAll trials: ${trials.map((tr) => `${fmt(tr.totalMs)}ms`).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
