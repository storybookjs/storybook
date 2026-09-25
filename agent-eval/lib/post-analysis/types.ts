// The contract between scripts/analyze-results.ts and the post-analysis module
// an experiment carries.
//
// It lives in lib/ rather than in the script so that lib/post-analysis/ can
// drive a module without importing upward from scripts/.
//
// A module implements two kinds of measurement, plus an aggregate:
//
//   analyzeRun               measures one tree in isolation. Called once per
//                            stored run, and — when the module also provides
//                            deltaToBaseline — once per external-repo pin
//                            against that pin's pristine tree.
//   deltaToBaseline          compares the two. This is the only entry point
//                            that requires the external repo to be
//                            materialized, so a module measuring runs in
//                            absolute terms never pays for the download.
//   summarize                folds every run it measured into grouped rows.
import type { ExternalRepoPin } from '../agentic-reference/external-repo.ts';

export type Analysis = Record<string, unknown>;

type Awaitable<T> = Promise<T> | T;

interface TreeContext {
  /** Absolute path to the tree being measured. */
  projectDir: string;
  /** Absolute path to the eval's own fixture directory, evals/<evalName>/. */
  fixtureDir: string;
  /** Name of the eval this measurement belongs to, i.e. evals/<evalName>/. */
  evalName: string;
}

/** `analyzeRun` against a stored run's collected project tree. */
export interface RunContext extends TreeContext {
  mode: 'run';
  /** Absolute path to this run's own directory. */
  runDir: string;
  /** Name of the experiment this run belongs to, i.e. results/<experiment>/. */
  experiment: string;
  /** Model identifier that produced this run. */
  model: string;
  /** Result directory's timestamp segment, e.g. 2026-07-27T10-43-55.864Z. */
  timestamp: string;
  /** 1-based run number within its eval, i.e. run-<run>/ on disk. */
  run: number;
  /** Parsed result.json, or null when missing/unreadable. */
  result: unknown;
  /** Parsed transcript.json. Mandatory for post-analysis. */
  transcript: unknown;
  /**
   * The external-repo pin this run recorded, resolved by the caller. Null when
   * the run recorded none — which only matters to an eval implementing
   * deltaToBaseline, since nothing else has anything to compare against.
   */
  pin: ExternalRepoPin | null;
}

/**
 * `analyzeRun` against a pinned external repo's pristine tree.
 *
 * Deliberately carries no eval: what a pinned tree is made of does not depend on
 * which eval is about to run against it, and a baseline that varied by eval
 * would be measured — and committed — once per eval for identical numbers.
 */
export interface BaselineContext {
  mode: 'baseline';
  /** Absolute path to the tree being measured. */
  projectDir: string;
  /** The pin whose materialized tree `projectDir` points at. */
  pin: ExternalRepoPin;
}

export type PostAnalysisContext = RunContext | BaselineContext;

/**
 * Everything `analyzeRun` saw for this run, plus the baseline side. Both trees
 * are on disk, so a metric that genuinely needs file contents on both sides
 * (a line diff, say) can still read them; `baselineAnalysis` exists so the
 * expensive whole-tree measurements are computed once per pin, not once per run.
 */
export interface DeltaToBaselineContext extends Omit<RunContext, 'pin'> {
  pin: ExternalRepoPin;
  /** What analyzeRun returned for this run. */
  runAnalysis: Analysis;
  /** Absolute path to the pin's materialized tree. */
  baselineDir: string;
  /** What analyzeRun returned for that tree, in `baseline` mode. */
  baselineAnalysis: Analysis;
}

/**
 * Which families of tables `summarize` should print, straight from the runner's
 * own flags. A module prints the families it has and ignores the rest.
 *
 * Only the console view is selectable: the returned rows are what gets
 * persisted, and are the same whatever prints.
 */
export interface SummarizeOptions {
  general: boolean;
  complexity: boolean;
  coverage: boolean;
  misuse: boolean;
  /**
   * Compute the rows without printing. The runner folds each eval directory
   * on its own (so its summary.json stays scoped to that directory) but
   * prints the wider comparable group instead, to avoid printing the same
   * rows twice.
   */
  quiet?: boolean;
}

export interface PostAnalysis {
  analyzeRun: (context: PostAnalysisContext) => Awaitable<Analysis | null>;
  /** Optional. Its presence is what makes the external repo a requirement. */
  deltaToBaseline?: (context: DeltaToBaselineContext) => Awaitable<Analysis | null>;
  /**
   * Optional version of the module's metric definitions. A committed baseline
   * is only reused when the version it was measured under matches this one, so
   * bumping it after changing what analyzeRun measures (or the shape it stores)
   * rebuilds stale baselines instead of comparing across definitions. Absent
   * both here and in the committed file counts as a match, which is what keeps
   * modules that never declare one on the old behavior.
   */
  metricsVersion?: number;
  /**
   * Aggregate one eval directory's runs — every run-* under a single
   * results/<experiment>/<model>/<timestamp>/<eval>/, so run-1 through run-N of
   * one arm at one point in time.
   *
   * Renders its own tables (only it knows which columns matter) and returns the
   * rows worth keeping. The runner writes those into that directory's
   * summary.json under `postAnalysis`, beside the harness's own pass rate and
   * mean duration, and collects them all into results/analysis-summary.json.
   *
   * `options` says which table families to print; omitted means "all of them",
   * which is what a direct programmatic call wants. The runner always passes
   * its own selection.
   */
  summarize: (analyses: Analysis[], options?: SummarizeOptions) => Analysis[];
}

/**
 * The experiment's half of the contract: the module that analyses its runs.
 * Runs of experiments carrying none are skipped.
 *
 * Declaring it on the experiment rather than per eval is what lets a family of
 * arms — same task and setup, differing only in prompt or MCP endpoint — share
 * one set of metrics, and lets one experiment span several evals. Arms sharing
 * a `postAnalysis` are summarized together, so they can be compared.
 *
 * The harness ignores this field; only scripts/analyze-results.ts reads it.
 */
export interface PostAnalysisExperiment {
  postAnalysis?: PostAnalysis;
}
