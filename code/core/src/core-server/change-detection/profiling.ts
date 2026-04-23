import { logger } from 'storybook/internal/node-logger';

/**
 * Internal perf profiler for change-detection.
 *
 * Gated on `STORYBOOK_CHANGE_DETECTION_PROFILE=1`. When disabled, every call is a no-op so
 * instrumented code pays no runtime cost. When enabled, every `build()` and every `patch()`
 * emit a one-line summary via `logger.info` and expose structured data for tests.
 *
 * The profiler is stateful per-operation. Concurrent operations will interleave counters —
 * not a concern in practice because `ChangeDetectionService` serialises builds (single
 * Promise.all) and awaits patches; the fire-and-forget dispatcher path can theoretically
 * race, but the emitted numbers are a rough debugging aid, not an audit log.
 */

export interface BuildSummary {
  operation: 'build';
  ms: number;
  filesParsed: number;
  specifiersResolved: number;
  parserDispatch: Record<string, number>;
  storyCount: number;
  reverseIndexSize: number;
}

export interface PatchSummary {
  operation: 'patch';
  ms: number;
  filesParsed: number;
  specifiersResolved: number;
  parserDispatch: Record<string, number>;
  kind: string;
  path: string;
  storiesReWalked: number;
}

export type ProfileSummary = BuildSummary | PatchSummary;

export interface ChangeDetectionProfiler {
  readonly enabled: boolean;
  buildStart(): void;
  buildEnd(result: { storyCount: number; reverseIndexSize: number }): BuildSummary | null;
  patchStart(event: { kind: string; path: string }): void;
  patchEnd(result: { storiesReWalked: number }): PatchSummary | null;
  recordParse(extension: string): void;
  recordResolve(): void;
  /** Test-only: replace the sink that summaries are emitted to. */
  setSink(sink: (summary: ProfileSummary) => void): void;
  /** Test-only: force-reset internal counters. */
  reset(): void;
}

class NoopProfiler implements ChangeDetectionProfiler {
  readonly enabled = false;
  buildStart(): void {}
  buildEnd(): null {
    return null;
  }
  patchStart(): void {}
  patchEnd(): null {
    return null;
  }
  recordParse(): void {}
  recordResolve(): void {}
  setSink(): void {}
  reset(): void {}
}

class ActiveProfiler implements ChangeDetectionProfiler {
  readonly enabled = true;
  private op: 'build' | 'patch' | null = null;
  private startTime = 0;
  private filesParsed = 0;
  private specifiersResolved = 0;
  private parserDispatch = new Map<string, number>();
  private patchEvent: { kind: string; path: string } | null = null;
  private sink: (summary: ProfileSummary) => void = defaultEmit;

  buildStart(): void {
    this.resetCounters();
    this.op = 'build';
    this.startTime = performance.now();
  }

  buildEnd(result: { storyCount: number; reverseIndexSize: number }): BuildSummary | null {
    if (this.op !== 'build') {
      return null;
    }
    const summary: BuildSummary = {
      operation: 'build',
      ms: performance.now() - this.startTime,
      filesParsed: this.filesParsed,
      specifiersResolved: this.specifiersResolved,
      parserDispatch: Object.fromEntries(this.parserDispatch),
      storyCount: result.storyCount,
      reverseIndexSize: result.reverseIndexSize,
    };
    this.op = null;
    this.sink(summary);
    return summary;
  }

  patchStart(event: { kind: string; path: string }): void {
    this.resetCounters();
    this.op = 'patch';
    this.startTime = performance.now();
    this.patchEvent = event;
  }

  patchEnd(result: { storiesReWalked: number }): PatchSummary | null {
    if (this.op !== 'patch' || !this.patchEvent) {
      return null;
    }
    const summary: PatchSummary = {
      operation: 'patch',
      ms: performance.now() - this.startTime,
      filesParsed: this.filesParsed,
      specifiersResolved: this.specifiersResolved,
      parserDispatch: Object.fromEntries(this.parserDispatch),
      kind: this.patchEvent.kind,
      path: this.patchEvent.path,
      storiesReWalked: result.storiesReWalked,
    };
    this.op = null;
    this.patchEvent = null;
    this.sink(summary);
    return summary;
  }

  recordParse(extension: string): void {
    if (!this.op) {
      return;
    }
    this.filesParsed += 1;
    this.parserDispatch.set(extension, (this.parserDispatch.get(extension) ?? 0) + 1);
  }

  recordResolve(): void {
    if (!this.op) {
      return;
    }
    this.specifiersResolved += 1;
  }

  setSink(sink: (summary: ProfileSummary) => void): void {
    this.sink = sink;
  }

  reset(): void {
    this.resetCounters();
    this.op = null;
    this.patchEvent = null;
    this.sink = defaultEmit;
  }

  private resetCounters(): void {
    this.filesParsed = 0;
    this.specifiersResolved = 0;
    this.parserDispatch.clear();
  }
}

function formatDispatch(dispatch: Record<string, number>): string {
  const entries = Object.entries(dispatch).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return '{}';
  }
  return `{${entries.map(([ext, n]) => `${ext}:${n}`).join(', ')}}`;
}

function defaultEmit(summary: ProfileSummary): void {
  if (summary.operation === 'build') {
    logger.info(
      `[change-detection] build: ${summary.ms.toFixed(1)}ms, ${summary.storyCount} stories, ${summary.filesParsed} parsed, ${summary.specifiersResolved} resolved ${formatDispatch(summary.parserDispatch)}`
    );
    return;
  }
  logger.info(
    `[change-detection] patch ${summary.kind} ${summary.path}: ${summary.ms.toFixed(1)}ms, ${summary.filesParsed} parsed, ${summary.specifiersResolved} resolved, ${summary.storiesReWalked} stories re-walked`
  );
}

function createProfiler(): ChangeDetectionProfiler {
  const flag = process.env.STORYBOOK_CHANGE_DETECTION_PROFILE;
  if (flag === '1' || flag === 'true') {
    return new ActiveProfiler();
  }
  return new NoopProfiler();
}

/**
 * Singleton used by the hot paths. A fresh instance is created at module load based on the
 * `STORYBOOK_CHANGE_DETECTION_PROFILE` env var; tests that want to enable it after the
 * module loads must call {@link _setProfilerForTesting}.
 */
export let profiler: ChangeDetectionProfiler = createProfiler();

/** Test-only: swap the profiler implementation. Keeps hot-path code branch-free. */
export function _setProfilerForTesting(replacement: ChangeDetectionProfiler): void {
  profiler = replacement;
}

/** Test-only: construct an ActiveProfiler regardless of env. */
export function _createActiveProfilerForTesting(): ChangeDetectionProfiler {
  return new ActiveProfiler();
}
