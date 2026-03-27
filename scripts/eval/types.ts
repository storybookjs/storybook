/**
 * Core types for the Storybook setup eval system.
 *
 * Three independent axes: agent × model × effort
 */

// --- Agent, Model, Effort ---

export type AgentName = "claude-code" | "codex";
export type Effort = "low" | "medium" | "high" | "max";

export const CLAUDE_MODELS = ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"] as const;
export const CODEX_MODELS = ["gpt-5.4"] as const;
export const ALL_MODELS = [...CLAUDE_MODELS, ...CODEX_MODELS] as const;
export const EFFORTS: Effort[] = ["low", "medium", "high", "max"];

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];
export type CodexModel = (typeof CODEX_MODELS)[number];
export type SupportedModel = ClaudeModel | CodexModel;

export const MODELS_BY_AGENT: Record<AgentName, readonly SupportedModel[]> = {
  "claude-code": CLAUDE_MODELS,
  codex: CODEX_MODELS,
};

// --- Project Types ---

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
  model: SupportedModel;
  effort: Effort;
  prompt?: string;
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

export interface QualityResult {
  score: number;
  breakdown: { build: number; typecheck: number };
}

// --- Final Result ---

export interface TrialResult {
  schemaVersion: 1;
  project: string;
  agent: string;
  model: string;
  effort: string;
  timestamp: string;
  prompt: string;
  baselineCommit: string;
  execution: ExecutionResult;
  grading: GradingResult;
  quality: QualityResult;
}

// --- Agent Interface ---

export interface Agent {
  name: AgentName;
  execute(
    prompt: string,
    projectPath: string,
    model: SupportedModel,
    options?: { effort?: Effort; verbose?: boolean; resultsDir?: string },
  ): Promise<ExecutionResult>;
}
