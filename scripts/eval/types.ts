/**
 * Core types for the Storybook setup eval system.
 *
 * The eval tests how well an AI agent can complete a Storybook setup
 * (after `npx storybook@latest init --yes`) across real-world projects.
 */

// --- Agent & Model Types ---

export type AgentName = 'claude-code' | 'codex';

export const CLAUDE_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'] as const;

export const CODEX_MODELS = ['o4-mini', 'o3', 'gpt-4.1'] as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];
export type CodexModel = (typeof CODEX_MODELS)[number];
export type SupportedModel = ClaudeModel | CodexModel;

export type ModelTier = 'opus' | 'sonnet' | 'haiku' | 'codex';

export const MODEL_TIERS: Record<SupportedModel, ModelTier> = {
  'claude-opus-4-6': 'opus',
  'claude-sonnet-4-6': 'sonnet',
  'claude-haiku-4-5': 'haiku',
  'o4-mini': 'codex',
  o3: 'codex',
  'gpt-4.1': 'codex',
};

export const SUPPORTED_MODELS_BY_AGENT: Record<AgentName, readonly SupportedModel[]> = {
  'claude-code': CLAUDE_MODELS,
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
  /** Prompt names to compose (from prompts/ dir). Defaults to ["setup"]. */
  prompts?: string[];
  verbose?: boolean;
}

export interface TrialPaths {
  trialDir: string;
  /** Root of the cloned repo (git root) */
  repoRoot: string;
  /** Working path where storybook lives (may differ from repoRoot for monorepos) */
  projectPath: string;
  resultsDir: string;
  /** The git commit hash of the post-init baseline */
  baselineCommit: string;
}

// --- Execution Types ---

export interface ExecutionResult {
  agent: string;
  model: string;
  cost?: number;
  duration: number;
  durationApi?: number;
  turns: number;
}

// --- Changed Files ---

export interface ChangedFile {
  path: string;
  status: 'A' | 'M' | 'D' | 'R';
}

// --- Setup Patterns ---

export interface SetupPattern {
  id: string;
  label: string;
  /** Files where this pattern was detected */
  sourceFiles: string[];
}

// --- Grading Types ---

export interface GradingResult {
  buildSuccess: boolean;
  buildError?: string;
  typeCheckErrors: number;
  typeCheckOutput?: string;
  /** Files changed by the agent (diff from post-init baseline) */
  changedFiles: ChangedFile[];
  /** Storybook-related files changed by the agent */
  storybookFiles: ChangedFile[];
  /** Setup patterns the agent configured */
  setupPatterns: SetupPattern[];
  /** Ghost stories grading (placeholder until CLI command exists) */
  ghostStories?: GhostStoriesResult;
}

/**
 * Ghost stories result - measures actual story rendering success.
 *
 * Currently a placeholder. The Storybook ghost stories feature is triggered
 * via channel events (ghostStoriesRequest), not a CLI command.
 * A `storybook ghost-stories` command needs to be built first.
 */
export interface GhostStoriesResult {
  /** How many candidate components were found */
  candidateCount: number;
  /** How many stories were generated and tested */
  total: number;
  /** How many stories rendered successfully */
  passed: number;
  /** Success rate (passed / total) */
  successRate: number;
}

// --- Quality Score ---

export interface QualityResult {
  score: number;
  breakdown: {
    build: number;
    typecheck: number;
  };
}

// --- Final Result ---

export interface TrialResult {
  schemaVersion: 1;
  project: string;
  agent: string;
  model: string;
  modelTier: ModelTier;
  timestamp: string;
  prompts: string[];
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
    options?: { verbose?: boolean; resultsDir?: string }
  ): Promise<ExecutionResult>;
}
