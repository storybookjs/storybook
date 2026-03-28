/**
 * Shared cost estimation from token usage.
 *
 * Pricing tables live in config.ts alongside agent definitions.
 * This module provides the math.
 */

import { AGENTS } from "../config.ts";
import type { AgentName } from "../types.ts";

export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

/** Estimate cost from token usage using the pricing table in config. */
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
