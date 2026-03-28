/**
 * Core types and config for the Storybook setup eval system.
 *
 * Four independent axes: agent × model × effort × prompt
 */

// --- Agent, Model, Effort ---

export type AgentName = "claude" | "codex";
export type Effort = "low" | "medium" | "high" | "max";

export const AGENTS: Record<AgentName, { models: string[]; defaultModel: string }> = {
  claude: {
    models: ["sonnet-4.6", "opus-4.6", "haiku-4.5"],
    defaultModel: "sonnet-4.6",
  },
  codex: {
    models: ["gpt-5.4"],
    defaultModel: "gpt-5.4",
  },
};

// --- Projects ---

export interface Project {
  name: string;
  repo: string;
  branch?: string;
  projectDir?: string;
  description?: string;
}

export const PROJECTS: Project[] = [
  {
    name: "mealdrop",
    repo: "https://github.com/kasperpeulen/mealdrop",
    branch: "eval-baseline",
    description: "Styled components, Redux, React Router",
  },
  {
    name: "edgy",
    repo: "https://github.com/kasperpeulen/edgy",
    branch: "eval-baseline",
    description: "Tailwind, HeadlessUI, React Router",
  },
  {
    name: "wikitok",
    repo: "https://github.com/kasperpeulen/wikitok",
    branch: "eval-baseline",
    projectDir: "frontend",
    description: "Simple project with Tailwind",
  },
  {
    name: "baklava",
    repo: "https://github.com/kasperpeulen/baklava",
    branch: "eval-baseline",
    description: "Component library with Zustand",
  },
  {
    name: "echarts",
    repo: "https://github.com/kasperpeulen/echarts-react",
    branch: "eval-baseline",
    description: "ECharts React wrapper",
  },
  {
    name: "evergreen-ci",
    repo: "https://github.com/kasperpeulen/ui",
    branch: "eval-baseline",
    projectDir: "packages/lib",
    description: "GraphQL",
  },
];

// --- Trial Types ---

export interface TrialConfig {
  project: Project;
  agent: AgentName;
  model: string;
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
  execute(
    prompt: string,
    projectPath: string,
    model: string,
    options?: { effort?: Effort; verbose?: boolean; resultsDir?: string },
  ): Promise<ExecutionResult>;
}
