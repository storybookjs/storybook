/**
 * Core types for the Storybook setup eval system.
 *
 * The eval tests how well an AI agent can complete a Storybook setup
 * (after `npx storybook@latest init --yes`) across real-world projects.
 */

// --- Agent & Model Types ---

export type AgentName = 'claude-code' | 'copilot-cli';

export const CLAUDE_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'] as const;

export const COPILOT_MODELS = [
  ...CLAUDE_MODELS,
  'gpt-5.2-codex',
  'gpt-5.2',
  'gpt-5.1-codex-max',
] as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];
export type CopilotModel = (typeof COPILOT_MODELS)[number];
export type SupportedModel = CopilotModel;

export type ModelTier = 'opus' | 'sonnet' | 'haiku' | 'codex';

export const MODEL_TIERS: Record<SupportedModel, ModelTier> = {
  'claude-opus-4-6': 'opus',
  'claude-sonnet-4-6': 'sonnet',
  'claude-haiku-4-5': 'haiku',
  'gpt-5.2-codex': 'codex',
  'gpt-5.2': 'codex',
  'gpt-5.1-codex-max': 'codex',
};

export const SUPPORTED_MODELS_BY_AGENT: Record<AgentName, readonly SupportedModel[]> = {
  'claude-code': CLAUDE_MODELS,
  'copilot-cli': COPILOT_MODELS,
};

// --- Project Types ---

export interface Project {
  /** Display name */
  name: string;
  /** Git repo URL */
  repo: string;
  /** Branch to clone (defaults to repo default) */
  branch?: string;
  /** Subdirectory within the repo where the project lives */
  projectDir?: string;
  /** Human-readable description of the project's tech stack */
  description?: string;
}

// --- Trial Types ---

export interface TrialConfig {
  project: Project;
  agent: AgentName;
  model: SupportedModel;
  /** Path to a custom prompt file (defaults to built-in setup.md) */
  promptFile?: string;
  verbose?: boolean;
}

export interface TrialPaths {
  /** Root directory for this trial */
  trialDir: string;
  /** Path to the project within the trial (where storybook is initialized) */
  projectPath: string;
  /** Path where grading outputs are saved */
  resultsDir: string;
}

// --- Execution Types ---

export interface ExecutionResult {
  agent: string;
  model: string;
  /** Total API cost in USD */
  cost?: number;
  /** Wall-clock duration in seconds */
  duration: number;
  /** API-only duration in seconds */
  durationApi?: number;
  /** Number of agent turns */
  turns: number;
}

// --- Grading Types ---

export interface GradingResult {
  /** Did `storybook build` exit with code 0? */
  buildSuccess: boolean;
  /** Build error output (if failed) */
  buildError?: string;
  /** Number of TypeScript errors from `tsc --noEmit` */
  typeCheckErrors: number;
  /** TypeScript error output */
  typeCheckOutput?: string;
}

// --- Quality Score ---

export interface QualityResult {
  /** Composite score from 0 to 1 */
  score: number;
  /** Individual metric scores */
  breakdown: {
    build: number;
    typecheck: number;
  };
}

// --- Final Result ---

export interface TrialResult {
  project: string;
  agent: string;
  model: string;
  modelTier: ModelTier;
  timestamp: string;
  promptFile: string;
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
