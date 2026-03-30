/**
 * Core types for the Storybook setup eval system.
 *
 * Plain TypeScript interfaces — runtime validation at the CLI boundary
 * uses zod (see eval.ts).
 */

// --- Logger ---

export interface Logger {
  log: (msg: string) => void;
  logStep: (msg: string) => void;
  logSuccess: (msg: string) => void;
  logError: (msg: string) => void;
}

// --- Agent ---

export type ClaudeModel = "sonnet-4.6" | "opus-4.6" | "haiku-4.5";
export type CodexModel = "gpt-5.4";
export type ClaudeEffort = "low" | "medium" | "high" | "max";
export type CodexEffort = "low" | "medium" | "high" | "xhigh";

/** Agent + model + effort — the three values that define how the agent runs. */
export type AgentVariant =
  | { agent: "claude"; model: ClaudeModel; effort: ClaudeEffort }
  | { agent: "codex"; model: CodexModel; effort: CodexEffort };

export type AgentId = AgentVariant["agent"];

export interface AgentExecuteParams {
  prompt: string;
  projectPath: string;
  variant: AgentVariant;
  resultsDir: string;
  logger: Logger;
}

export interface AgentDriver {
  name: AgentId;
  execute(params: AgentExecuteParams): Promise<Execution>;
}

// --- Project ---

export interface Project {
  name: string;
  repo: string;
  branch: string;
  projectDir?: string;
  description?: string;
}

// --- Trial Config ---

export interface TrialConfig {
  /** Which project to evaluate (cloned from its eval-baseline branch). */
  project: Project;
  /** Agent, model, and effort level. */
  variant: AgentVariant;
  /** Prompt name — maps to `prompts/{name}.md` (e.g. "setup", "self-heal"). */
  prompt: string;
  /** Log agent messages to stdout. */
  verbose?: boolean;
}

// --- Trial Workspace ---

export interface TrialWorkspace {
  trialDir: string;
  repoRoot: string;
  projectPath: string;
  resultsDir: string;
  baselineCommit: string;
}

// --- Execution ---

export interface Execution {
  cost?: number;
  duration: number;
  durationApi?: number;
  turns: number;
}

// --- File Changes ---

export interface FileChange {
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

export interface GhostStoryGrade {
  candidateCount: number;
  total: number;
  passed: number;
  successRate: number;
}

// --- Grading ---

export interface Grade {
  buildSuccess: boolean;
  buildError?: string;
  typeCheckErrors: number;
  typeCheckOutput?: string;
  fileChanges: FileChange[];
  storybookChanges: FileChange[];
  setupPatterns: SetupPattern[];
  ghostStories?: GhostStoryGrade;
}

// --- Quality Score ---

export interface ScoreWeights {
  ghostStories: number;
  build: number;
  typecheck: number;
  performance: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  ghostStories: 0.4,
  build: 0.25,
  typecheck: 0.25,
  performance: 0.1,
};

export interface QualityScore {
  score: number;
  breakdown: {
    build: number;
    typecheck: number;
    ghostStories: number;
    performance: number;
  };
}

// --- Trial Report ---

export interface TrialReport {
  schemaVersion: 1;
  project: Project;
  variant: AgentVariant;
  prompt: string;
  timestamp: string;
  baselineCommit: string;
  execution: Execution;
  grade: Grade;
  score: QualityScore;
}
