/**
 * Core types for the Storybook setup eval system.
 *
 * Four independent axes: agent x model x effort x prompt
 *
 * Runtime configuration (AGENTS, PROJECTS) lives in config.ts.
 */

// --- Logger ---

export interface Logger {
  log: (msg: string) => void;
  logStep: (msg: string) => void;
  logSuccess: (msg: string) => void;
  logError: (msg: string) => void;
}

// --- Agent, Model, Effort ---

export type AgentName = "claude" | "codex";

// --- Projects ---

export interface Project {
  name: string;
  repo: string;
  branch?: string;
  projectDir?: string;
  description?: string;
}

// --- Trial Types ---

export interface TrialConfig {
  project: Project;
  agent: AgentName;
  model: string;
  effort: string;
  prompt: string;
  verbose?: boolean;
}

export interface TrialPaths {
  trialDir: string;
  repoRoot: string;
  projectPath: string;
  resultsDir: string;
  baselineCommit: string;
}

// --- Execution Types ---

export interface ExecutionResult {
  agent: string;
  model: string;
  effort: string;
  cost?: number;
  duration: number;
  durationApi?: number;
  turns: number;
}

// --- Changed Files ---

export interface ChangedFile {
  path: string;
  status: "A" | "M" | "D" | "R";
}

// --- Setup Patterns ---

export interface SetupPattern {
  id: string;
  label: string;
  sourceFiles: string[];
}

// --- Grading Types ---

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

export interface GhostStoriesResult {
  candidateCount: number;
  total: number;
  passed: number;
  successRate: number;
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
  breakdown: { build: number; typecheck: number; ghostStories: number; performance: number };
}

// --- Final Result ---

export interface TrialResult {
  schemaVersion: 1;
  project: string;
  agent: string;
  model: string;
  effort: string;
  prompt: string;
  timestamp: string;
  baselineCommit: string;
  execution: ExecutionResult;
  grading: GradingResult;
  quality: QualityResult;
}

// --- Agent Interface ---

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
