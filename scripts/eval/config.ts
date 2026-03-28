/**
 * Runtime configuration for the Storybook eval system.
 *
 * Types live in types.ts — this file holds the concrete values.
 */

import type { AgentName, Project } from "./types.ts";

export interface AgentConfig {
  models: string[];
  defaultModel: string;
  efforts: string[];
  defaultEffort: string;
}

export const AGENTS: Record<AgentName, AgentConfig> = {
  claude: {
    models: ["sonnet-4.6", "opus-4.6", "haiku-4.5"],
    defaultModel: "sonnet-4.6",
    efforts: ["low", "medium", "high", "max"],
    defaultEffort: "high",
  },
  codex: {
    models: ["gpt-5.4"],
    defaultModel: "gpt-5.4",
    efforts: ["low", "medium", "high", "xhigh"],
    defaultEffort: "high",
  },
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
