/**
 * Core types for the Storybook setup eval system.
 *
 * Plain TypeScript interfaces — no runtime validation library.
 * Validation happens at the boundaries (CLI parsing via citty).
 */

// --- Logger ---

export interface Logger {
  log: (msg: string) => void;
  logStep: (msg: string) => void;
  logSuccess: (msg: string) => void;
  logError: (msg: string) => void;
}

// --- Agent ---

export type AgentName = "claude" | "codex";

/** Agent + model + effort — the three values that define how the agent runs. */
export interface AgentRunConfig {
  agent: AgentName;
  /** Friendly model name (e.g. "sonnet-4.6", "gpt-5.4"). Must exist in `AGENTS[agent].models`. */
  model: string;
  /** Reasoning effort level. Must exist in `AGENTS[agent].efforts`. */
  effort: string;
}

export interface Agent {
  name: AgentName;
  execute(params: {
    prompt: string;
    projectPath: string;
    model: string;
    effort: string;
    resultsDir: string;
    logger: Logger;
  }): Promise<ExecutionResult>;
}

// --- Project ---

export interface Project {
  name: string;
  repo: string;
  branch?: string;
  projectDir?: string;
  description?: string;
}

// --- Trial Config ---

export interface TrialConfig {
  /** Which project to evaluate (cloned from its eval-baseline branch). */
  project: Project;
  /** Agent, model, and effort level. */
  run: AgentRunConfig;
  /** Prompt name — maps to `prompts/{name}.md` (e.g. "setup", "self-heal"). */
  prompt: string;
  /** Log agent messages to stdout. */
  verbose?: boolean;
}

// --- Trial Paths ---

export interface TrialPaths {
  trialDir: string;
  repoRoot: string;
  projectPath: string;
  resultsDir: string;
  baselineCommit: string;
}

// --- Execution ---

export interface ExecutionResult {
  run: AgentRunConfig;
  cost?: number;
  duration: number;
  durationApi?: number;
  turns: number;
}

// --- Changed Files ---

export interface ChangedFile {
  path: string;
  status: "A" | "M" | "D" | "R";
  /** For renames, the original path before the move. */
  previousPath?: string;
}

// --- Setup Patterns ---

export interface SetupPattern {
  id: string;
  label: string;
  sourceFiles: string[];
}

// --- Ghost Stories ---

export interface GhostStoriesResult {
  candidateCount: number;
  total: number;
  passed: number;
  successRate: number;
}

// --- Grading ---

export interface GradingResult {
  buildSuccess: boolean;
  buildError?: string;
  typeCheckErrors: number;
  typeCheckOutput?: string;
  changedFiles: ChangedFile[];
  storybookFiles: ChangedFile[];
  setupPatterns: SetupPattern[];
  ghostStories?: GhostStoriesResult;
}

// --- Quality Score ---

export interface QualityWeights {
  ghostStories: number;
  build: number;
  typecheck: number;
  performance: number;
}

export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = {
  ghostStories: 0.4,
  build: 0.25,
  typecheck: 0.25,
  performance: 0.1,
};

export interface QualityResult {
  score: number;
  breakdown: {
    build: number;
    typecheck: number;
    ghostStories: number;
    performance: number;
  };
}

// --- Trial Result ---

export interface TrialResult {
  schemaVersion: 1;
  project: string;
  run: AgentRunConfig;
  prompt: string;
  timestamp: string;
  baselineCommit: string;
  execution: ExecutionResult;
  grading: GradingResult;
  quality: QualityResult;
}
