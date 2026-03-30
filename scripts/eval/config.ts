/**
 * Runtime configuration for the Storybook eval system.
 *
 * Agent configs, model mappings, pricing, benchmark project definitions,
 * and cost estimation utilities.
 */

import {
  CLAUDE_MODELS,
  CODEX_MODELS,
  CLAUDE_EFFORTS,
  CODEX_EFFORTS,
  type AgentId,
  type Project,
} from './types.ts';

// --- Pricing ---

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

// --- Agent Definition ---

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
    defaultEffort: 'high',
  },
  codex: {
    models: CODEX_MODELS,
    defaultModel: 'gpt-5.4',
    sdkModelIds: {},
    pricing: {
      'gpt-5.4': { input: 2.5, cachedInput: 0.625, output: 10.0 },
    },
    efforts: CODEX_EFFORTS,
    defaultEffort: 'high',
  },
};

// --- Cost Estimation ---

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

// --- Projects ---

export const PROJECTS: Project[] = [
  {
    name: 'mealdrop',
    repo: 'https://github.com/kasperpeulen/mealdrop',
    branch: 'eval-baseline',
    description: 'Styled components, Redux, React Router',
  },
  {
    name: 'edgy',
    repo: 'https://github.com/kasperpeulen/edgy',
    branch: 'eval-baseline',
    description: 'Tailwind, HeadlessUI, React Router',
  },
  {
    name: 'wikitok',
    repo: 'https://github.com/kasperpeulen/wikitok',
    branch: 'eval-baseline',
    projectDir: 'frontend',
    description: 'Simple project with Tailwind',
  },
  {
    name: 'baklava',
    repo: 'https://github.com/kasperpeulen/baklava',
    branch: 'eval-baseline',
    description: 'Component library with Zustand',
  },
  {
    name: 'echarts',
    repo: 'https://github.com/kasperpeulen/echarts-react',
    branch: 'eval-baseline',
    description: 'ECharts React wrapper',
  },
  {
    name: 'evergreen-ci',
    repo: 'https://github.com/kasperpeulen/ui',
    branch: 'eval-baseline',
    projectDir: 'packages/lib',
    description: 'GraphQL',
  },
];
