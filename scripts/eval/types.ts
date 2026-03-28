/**
 * Core types for the Storybook setup eval system.
 *
 * Data types use Zod schemas for runtime validation.
 * Behavioral interfaces (Logger, Agent) stay as plain TypeScript.
 */

import { z } from "zod";

// --- Logger (behavioral interface — not validated at runtime) ---

export interface Logger {
  log: (msg: string) => void;
  logStep: (msg: string) => void;
  logSuccess: (msg: string) => void;
  logError: (msg: string) => void;
}

// --- Agent Name ---

export const AgentName = z.enum(["claude", "codex"]);
export type AgentName = z.infer<typeof AgentName>;

// --- Project ---

export const Project = z.object({
  name: z.string().min(1),
  repo: z.string().url(),
  branch: z.string().optional(),
  projectDir: z.string().optional(),
  description: z.string().optional(),
});
export type Project = z.infer<typeof Project>;

// --- Trial Config ---

export const TrialConfig = z.object({
  project: Project,
  agent: AgentName,
  model: z.string(),
  effort: z.string(),
  prompt: z.string(),
  verbose: z.boolean().optional(),
});
export type TrialConfig = z.infer<typeof TrialConfig>;

// --- Trial Paths ---

export const TrialPaths = z.object({
  trialDir: z.string(),
  repoRoot: z.string(),
  projectPath: z.string(),
  resultsDir: z.string(),
  baselineCommit: z.string(),
});
export type TrialPaths = z.infer<typeof TrialPaths>;

// --- Execution ---

export const ExecutionResult = z.object({
  agent: z.string(),
  model: z.string(),
  effort: z.string(),
  cost: z.number().optional(),
  duration: z.number(),
  durationApi: z.number().optional(),
  turns: z.number(),
});
export type ExecutionResult = z.infer<typeof ExecutionResult>;

// --- Changed Files ---

export const ChangedFile = z.object({
  path: z.string(),
  status: z.enum(["A", "M", "D", "R"]),
});
export type ChangedFile = z.infer<typeof ChangedFile>;

// --- Setup Patterns ---

export const SetupPattern = z.object({
  id: z.string(),
  label: z.string(),
  sourceFiles: z.array(z.string()),
});
export type SetupPattern = z.infer<typeof SetupPattern>;

// --- Ghost Stories ---

export const GhostStoriesResult = z.object({
  candidateCount: z.number(),
  total: z.number(),
  passed: z.number(),
  successRate: z.number(),
});
export type GhostStoriesResult = z.infer<typeof GhostStoriesResult>;

// --- Grading ---

export const GradingResult = z.object({
  buildSuccess: z.boolean(),
  buildError: z.string().optional(),
  typeCheckErrors: z.number(),
  typeCheckOutput: z.string().optional(),
  changedFiles: z.array(ChangedFile),
  storybookFiles: z.array(ChangedFile),
  setupPatterns: z.array(SetupPattern),
  ghostStories: GhostStoriesResult.optional(),
});
export type GradingResult = z.infer<typeof GradingResult>;

// --- Quality Score ---

export const QualityWeights = z.object({
  ghostStories: z.number().default(0.4),
  build: z.number().default(0.25),
  typecheck: z.number().default(0.25),
  performance: z.number().default(0.1),
});
export type QualityWeights = z.infer<typeof QualityWeights>;

export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = QualityWeights.parse({});

export const QualityResult = z.object({
  score: z.number(),
  breakdown: z.object({
    build: z.number(),
    typecheck: z.number(),
    ghostStories: z.number(),
    performance: z.number(),
  }),
});
export type QualityResult = z.infer<typeof QualityResult>;

// --- Trial Result ---

export const TrialResult = z.object({
  schemaVersion: z.literal(1),
  project: z.string(),
  agent: z.string(),
  model: z.string(),
  effort: z.string(),
  prompt: z.string(),
  timestamp: z.string(),
  baselineCommit: z.string(),
  execution: ExecutionResult,
  grading: GradingResult,
  quality: QualityResult,
});
export type TrialResult = z.infer<typeof TrialResult>;

// --- Agent Interface (behavioral — not validated) ---

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
