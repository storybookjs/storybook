/**
 * Core types for the Storybook setup eval system.
 *
 * Three independent axes: model × effort × prompt
 * Agent is derived from the model.
 */

// --- Agent, Model, Effort ---

export type AgentName = "claude-code" | "codex";
export type Effort = "low" | "medium" | "high" | "max";

export const MODELS = [
  { id: "claude-sonnet-4-6", agent: "claude-code" as AgentName, label: "Sonnet 4.6" },
  { id: "claude-opus-4-6", agent: "claude-code" as AgentName, label: "Opus 4.6" },
  { id: "gpt-5.4-medium", agent: "codex" as AgentName, label: "GPT 5.4 Medium", effort: "medium" as Effort },
  { id: "gpt-5.4-high", agent: "codex" as AgentName, label: "GPT 5.4 High", effort: "high" as Effort },
] as const;

export type SupportedModel = (typeof MODELS)[number]["id"];

export function agentForModel(model: string): AgentName {
  const entry = MODELS.find((m) => m.id === model);
  if (!entry) throw new Error(`Unknown model: ${model}`);
  return entry.agent;
}

export function effortForModel(model: string, defaultEffort: Effort): Effort {
  const entry = MODELS.find((m) => m.id === model);
  return (entry as { effort?: Effort })?.effort ?? defaultEffort;
}

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
  execute(
    prompt: string,
    projectPath: string,
    model: SupportedModel,
    options?: { effort?: Effort; verbose?: boolean; resultsDir?: string },
  ): Promise<ExecutionResult>;
}
