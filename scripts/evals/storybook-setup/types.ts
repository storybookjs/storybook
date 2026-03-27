export type AgentName = 'claude-code' | 'codex-cli';

export type ModelTier = 'opus' | 'sonnet' | 'haiku';
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export type PackageManager = 'npm' | 'pnpm' | 'yarn';

export type PromptVariant = {
  id: string;
  label: string;
  description: string;
  promptFiles: string[];
};

export type BenchmarkProject = {
  id: string;
  name: string;
  repo: string;
  branch?: string;
  projectDir?: string;
  description: string;
  tags: string[];
};

export type SupportedModel =
  | 'claude-opus-4.6'
  | 'claude-sonnet-4.6'
  | 'claude-haiku-4.5'
  | 'gpt-5.4'
  | 'gpt-5-codex'
  | 'gpt-5-codex-mini'
  | 'gpt-5.4-mini'
  | 'gpt-5.2-codex';

export type ModelConfig = {
  id: SupportedModel;
  agent: AgentName;
  cliModel: string;
  tier: ModelTier;
  label: string;
  reasoningEffort: ReasoningEffort;
  notes?: string;
};

export type CommandRecord = {
  name: string;
  command: string;
  cwd: string;
  durationMs: number;
  exitCode: number;
  logPath: string;
};

export type StepResult = {
  status: 'passed' | 'failed' | 'skipped';
  reason?: string;
  command?: CommandRecord;
};

export type PackageJsonCleanup = {
  path: string;
  removedDependencies: string[];
  removedScripts: string[];
};

export type CleanupSummary = {
  removedFiles: string[];
  removedDirectories: string[];
  updatedPackageJsons: PackageJsonCleanup[];
};

export type CandidateComponent = {
  path: string;
  complexity: number;
};

export type SetupPattern = {
  id: string;
  label: string;
  sourceFiles: string[];
};

export type ChangedFileSummary = {
  path: string;
  status: 'A' | 'M' | 'D' | 'R';
  addedLines: number;
  removedLines: number;
};

export type GhostStoriesSummary = {
  candidateCount: number;
  analyzedCount?: number;
  avgComplexity?: number;
  total?: number;
  passed?: number;
  passedButEmptyRender?: number;
  successRate?: number;
  successRateWithoutEmptyRender?: number;
  uniqueErrorCount?: number;
  categorizedErrors?: Record<
    string,
    {
      count: number;
      uniqueCount: number;
      matchedDependencies: string[];
    }
  >;
  runError?: string;
};

export type GhostStoriesResult = StepResult & {
  summary?: GhostStoriesSummary;
};

export type AgentExecutionSummary = {
  durationMs: number;
  apiDurationMs?: number;
  turns?: number;
  costUsd?: number;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  finalMessage?: string;
  commandExecutions: Array<{
    command: string;
    exitCode?: number;
  }>;
  toolCalls: Array<{
    name: string;
    input?: Record<string, unknown>;
  }>;
  validationCommands: string[];
  transcriptPath: string;
  stderrPath: string;
};

export type PreparedProject = {
  benchmark: BenchmarkProject;
  packageManager: PackageManager;
  repoRoot: string;
  projectRoot: string;
  targetDirLabel: string;
  candidateComponents: CandidateComponent[];
  cleanup: CleanupSummary;
  install: CommandRecord;
  init: CommandRecord;
  postInitInstall: CommandRecord;
  baselineCommit: string;
};

export type EvalResult = {
  schemaVersion: 1;
  benchmark: {
    id: string;
    name: string;
    repo: string;
    branch: string;
    projectDir: string;
    tags: string[];
  };
  variant: {
    id: string;
    label: string;
    description: string;
  };
  agent: {
    name: AgentName;
    model: SupportedModel;
    tier: ModelTier;
  };
  environment: {
    nodeVersion: string;
    packageManager: PackageManager;
    repoRoot: string;
    projectRoot: string;
    cliVersions: {
      claude?: string;
      codex?: string;
    };
  };
  preparation: {
    cleanup: CleanupSummary;
    install: CommandRecord;
    init: CommandRecord;
    postInitInstall: CommandRecord;
    baselineCommit: string;
    candidateComponents: CandidateComponent[];
  };
  execution?: AgentExecutionSummary;
  changes: {
    files: ChangedFileSummary[];
    storybookFiles: ChangedFileSummary[];
    setupPatterns: SetupPattern[];
  };
  grading: {
    storybookBuild: StepResult;
    ghostStories: {
      before: GhostStoriesResult;
      after: GhostStoriesResult;
    };
  };
  artifacts: {
    trialDir: string;
    logsDir: string;
    promptPath: string;
    resultPath: string;
  };
};

export type RunOptions = {
  benchmarkId: string;
  agent: AgentName;
  model?: SupportedModel;
  tier?: ModelTier;
  variantId: string;
  workspaceRoot: string;
  prepareOnly?: boolean;
  promptFile?: string;
};
