/**
 * Runtime configuration for the Storybook eval system.
 *
 * Types live in types.ts — this file holds the concrete agent configs,
 * model mappings, pricing, and benchmark project definitions.
 *
 * Agent configs are validated with Zod at import time — invalid config
 * (e.g. defaultModel not in models list) throws immediately.
 */

import { z } from "zod";
import type { AgentName, Project } from "./types.ts";

// --- Pricing ---

export const Pricing = z.object({
  input: z.number(),
  cachedInput: z.number(),
  output: z.number(),
});
export type Pricing = z.infer<typeof Pricing>;

// --- Agent Config ---

export const AgentConfig = z
  .object({
    models: z.array(z.string()).min(1),
    defaultModel: z.string(),
    /** Map friendly model names to SDK-specific model IDs (e.g. "sonnet-4.6" → "claude-sonnet-4-6"). */
    sdkModelIds: z.record(z.string(), z.string()).default({}),
    /** Per-million-token pricing for manual cost estimation (agents that don't report cost natively). */
    pricing: z.record(z.string(), Pricing).default({}),
    efforts: z.array(z.string()).min(1),
    defaultEffort: z.string(),
  })
  .refine((cfg) => cfg.models.includes(cfg.defaultModel), {
    message: "defaultModel must be in models list",
  })
  .refine((cfg) => cfg.efforts.includes(cfg.defaultEffort), {
    message: "defaultEffort must be in efforts list",
  });
export type AgentConfig = z.infer<typeof AgentConfig>;

export const AGENTS: Record<AgentName, AgentConfig> = {
  claude: AgentConfig.parse({
    models: ["sonnet-4.6", "opus-4.6", "haiku-4.5"],
    defaultModel: "sonnet-4.6",
    sdkModelIds: {
      "sonnet-4.6": "claude-sonnet-4-6",
      "opus-4.6": "claude-opus-4-6",
      "haiku-4.5": "claude-haiku-4-5",
    },
    efforts: ["low", "medium", "high", "max"],
    defaultEffort: "high",
  }),
  codex: AgentConfig.parse({
    models: ["gpt-5.4"],
    defaultModel: "gpt-5.4",
    pricing: {
      "gpt-5.4": { input: 2.5, cachedInput: 0.625, output: 10.0 },
    },
    efforts: ["low", "medium", "high", "xhigh"],
    defaultEffort: "high",
  }),
};

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
