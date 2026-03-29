/**
 * Runtime configuration for the Storybook eval system.
 *
 * Agent configs, model mappings, pricing, benchmark project definitions,
 * and cost estimation utilities.
 */

import type { AgentName, Project } from "./types.ts";

// --- Pricing ---

export interface Pricing {
  input: number;
  cachedInput: number;
  output: number;
}

export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

// --- Agent Config ---

export interface AgentConfig {
  models: string[];
  defaultModel: string;
  /** Map friendly model names to SDK-specific model IDs (e.g. "sonnet-4.6" → "claude-sonnet-4-6"). */
  sdkModelIds: Record<string, string>;
  /** Per-million-token pricing for manual cost estimation (agents that don't report cost natively). */
  pricing: Record<string, Pricing>;
  efforts: string[];
  defaultEffort: string;
}

export const AGENTS: Record<AgentName, AgentConfig> = {
  claude: {
    models: ["sonnet-4.6", "opus-4.6", "haiku-4.5"],
    defaultModel: "sonnet-4.6",
    sdkModelIds: {
      "sonnet-4.6": "claude-sonnet-4-6",
      "opus-4.6": "claude-opus-4-6",
      "haiku-4.5": "claude-haiku-4-5",
    },
    pricing: {},
    efforts: ["low", "medium", "high", "max"],
    defaultEffort: "high",
  },
  codex: {
    models: ["gpt-5.4"],
    defaultModel: "gpt-5.4",
    sdkModelIds: {},
    pricing: {
      "gpt-5.4": { input: 2.5, cachedInput: 0.625, output: 10.0 },
    },
    efforts: ["low", "medium", "high", "xhigh"],
    defaultEffort: "high",
  },
};

// --- Cost Estimation ---

/** Estimate cost from token usage using the pricing table. */
export function estimateCost(agent: AgentName, model: string, usage: TokenUsage): number | undefined {
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
