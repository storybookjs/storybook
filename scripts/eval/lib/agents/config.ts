/**
 * Agent definitions, model mappings, pricing, and cost estimation.
 */

import type { Logger } from "../utils.ts";

export const CLAUDE_MODELS = ["sonnet-4.6", "opus-4.6", "haiku-4.5"] as const;
export const CODEX_MODELS = ["gpt-5.4"] as const;
export const ALL_MODELS = [...CLAUDE_MODELS, ...CODEX_MODELS] as const;

export const CLAUDE_EFFORTS = ["low", "medium", "high", "max"] as const;
export const CODEX_EFFORTS = ["low", "medium", "high", "xhigh"] as const;
export const ALL_EFFORTS = ["low", "medium", "high", "max", "xhigh"] as const;

export const AGENT_IDS = ["claude", "codex"] as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];
export type CodexModel = (typeof CODEX_MODELS)[number];
export type ClaudeEffort = (typeof CLAUDE_EFFORTS)[number];
export type CodexEffort = (typeof CODEX_EFFORTS)[number];

/** Agent + model + effort — validated as a discriminated union at the CLI boundary. */
export type AgentVariant =
  | { agent: "claude"; model: ClaudeModel; effort: ClaudeEffort }
  | { agent: "codex"; model: CodexModel; effort: CodexEffort };

export type AgentId = AgentVariant["agent"];

export interface Execution {
  cost?: number;
  duration: number;
  durationApi?: number;
  turns: number;
  terminalResultSubtype?: string;
}

export interface AgentExecutionResult {
  execution: Execution;
  transcript: unknown[];
}

export interface AgentExecuteParams {
  prompt: string;
  projectPath: string;
  variant: AgentVariant;
  resultsDir: string;
  logger: Logger;
}

export interface AgentDriver {
  name: AgentId;
  execute(params: AgentExecuteParams): Promise<AgentExecutionResult>;
}

export interface TokenPricing {
  input: number;
  cachedInput: number;
  output: number;
}

export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export type ClaudeTool = "Read" | "Write" | "Edit" | "Bash" | "Glob" | "Grep";

export interface ClaudeExecutionConfig {
  /**
   * Bash is toggled here at the harness level, but individual shell commands still execute through
   * Claude's Bash tool rather than through a separate command allowlist.
   */
  allowedTools: readonly ClaudeTool[];
  debug: boolean;
  systemPrompt: { type: "preset"; preset: "claude_code" };
  /** Claude access is controlled through the explicit tool allowlist above. */
  permissionModel: "tool-allowlist";
}

export interface CodexExecutionConfig {
  /** Codex runs non-interactively so benchmark runs never block on approval prompts. */
  approvalPolicy: "never";
  permissionModel: "approval-policy-never";
}

export interface AgentDefinition<
  TModel extends string,
  TEffort extends string,
  TExecution,
> {
  models: readonly TModel[];
  defaultModel: TModel;
  /** Map friendly model names to SDK-specific model IDs (e.g. "sonnet-4.6" → "claude-sonnet-4-6"). */
  sdkModelIds: Partial<Record<TModel, string>>;
  /** Per-million-token pricing for manual cost estimation (agents that don't report cost natively). */
  pricing: Partial<Record<TModel, TokenPricing>>;
  efforts: readonly TEffort[];
  defaultEffort: TEffort;
  execution: TExecution;
}

export type ClaudeDefinition = AgentDefinition<
  ClaudeModel,
  ClaudeEffort,
  ClaudeExecutionConfig
>;
export type CodexDefinition = AgentDefinition<
  CodexModel,
  CodexEffort,
  CodexExecutionConfig
>;

export interface AgentDefinitions {
  claude: ClaudeDefinition;
  codex: CodexDefinition;
}

export const AGENTS: AgentDefinitions = {
  claude: {
    models: CLAUDE_MODELS,
    defaultModel: "sonnet-4.6",
    sdkModelIds: {
      "sonnet-4.6": "claude-sonnet-4-6",
      "opus-4.6": "claude-opus-4-6",
      "haiku-4.5": "claude-haiku-4-5",
    },
    pricing: {},
    efforts: CLAUDE_EFFORTS,
    defaultEffort: "medium",
    execution: {
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      debug: true,
      systemPrompt: { type: "preset", preset: "claude_code" },
      permissionModel: "tool-allowlist",
    },
  },
  codex: {
    models: CODEX_MODELS,
    defaultModel: "gpt-5.4",
    sdkModelIds: {},
    pricing: {
      "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15.0 },
    },
    efforts: CODEX_EFFORTS,
    defaultEffort: "medium",
    execution: {
      approvalPolicy: "never",
      permissionModel: "approval-policy-never",
    },
  },
};

export function getDefaultVariant<T extends AgentId>(
  agent: T,
): Extract<AgentVariant, { agent: T }> {
  const definition = AGENTS[agent];
  return {
    agent,
    model: definition.defaultModel,
    effort: definition.defaultEffort,
  } as Extract<AgentVariant, { agent: T }>;
}

export function resolveClaudeSdkModel(model: ClaudeModel): string {
  return AGENTS.claude.sdkModelIds[model] ?? model;
}

/** Estimate cost from token usage using the pricing table. */
export function estimateCost(
  agent: AgentId,
  model: string,
  usage: TokenUsage,
): number | undefined {
  const pricing =
    agent === "claude"
      ? AGENTS.claude.pricing[model as ClaudeModel]
      : AGENTS.codex.pricing[model as CodexModel];
  if (!pricing) return undefined;
  const freshInput = usage.inputTokens - usage.cachedInputTokens;
  return (
    (freshInput / 1_000_000) * pricing.input +
    (usage.cachedInputTokens / 1_000_000) * pricing.cachedInput +
    (usage.outputTokens / 1_000_000) * pricing.output
  );
}
