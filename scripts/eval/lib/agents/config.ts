/**
 * Agent definitions, model mappings, pricing, and cost estimation.
 */

import type { Logger } from '../utils.ts';

export const CLAUDE_MODELS = ['sonnet-4.6', 'opus-4.6', 'haiku-4.5'] as const;
export const CODEX_MODELS = ['gpt-5.4'] as const;
export const ALL_MODELS = [...CLAUDE_MODELS, ...CODEX_MODELS] as const;

export const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'max'] as const;
export const CODEX_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
export const ALL_EFFORTS = ['low', 'medium', 'high', 'max', 'xhigh'] as const;

export const AGENT_IDS = ['claude', 'codex'] as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];
export type CodexModel = (typeof CODEX_MODELS)[number];
export type ClaudeEffort = (typeof CLAUDE_EFFORTS)[number];
export type CodexEffort = (typeof CODEX_EFFORTS)[number];

/** Agent + model + effort — validated as a discriminated union at the CLI boundary. */
export type AgentVariant =
  | { agent: 'claude'; model: ClaudeModel; effort: ClaudeEffort }
  | { agent: 'codex'; model: CodexModel; effort: CodexEffort };

export type AgentId = AgentVariant['agent'];

export interface Execution {
  cost?: number;
  duration: number;
  durationApi?: number;
  turns: number;
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
  execute(params: AgentExecuteParams): Promise<Execution>;
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

export interface AgentDefinition {
  models: readonly string[];
  defaultModel: string;
  /** Map friendly model names to SDK-specific model IDs (e.g. "sonnet-4.6" → "claude-sonnet-4-6"). */
  sdkModelIds: Record<string, string>;
  /** Per-million-token pricing for manual cost estimation (agents that don't report cost natively). */
  pricing: Record<string, TokenPricing>;
  efforts: readonly string[];
  defaultEffort: string;
}

export const AGENTS: Record<AgentId, AgentDefinition> = {
  claude: {
    models: CLAUDE_MODELS,
    defaultModel: 'sonnet-4.6',
    sdkModelIds: {
      'sonnet-4.6': 'claude-sonnet-4-6',
      'opus-4.6': 'claude-opus-4-6',
      'haiku-4.5': 'claude-haiku-4-5',
    },
    pricing: {},
    efforts: CLAUDE_EFFORTS,
    defaultEffort: 'medium',
  },
  codex: {
    models: CODEX_MODELS,
    defaultModel: 'gpt-5.4',
    sdkModelIds: {},
    pricing: {
      'gpt-5.4': { input: 2.5, cachedInput: 0.25, output: 15.0 },
    },
    efforts: CODEX_EFFORTS,
    defaultEffort: 'medium',
  },
};

/** Estimate cost from token usage using the pricing table. */
export function estimateCost(agent: AgentId, model: string, usage: TokenUsage): number | undefined {
  const pricing = AGENTS[agent].pricing[model];
  if (!pricing) return undefined;
  const freshInput = usage.inputTokens - usage.cachedInputTokens;
  return (
    (freshInput / 1_000_000) * pricing.input +
    (usage.cachedInputTokens / 1_000_000) * pricing.cachedInput +
    (usage.outputTokens / 1_000_000) * pricing.output
  );
}
