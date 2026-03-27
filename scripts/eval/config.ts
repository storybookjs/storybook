import type { AgentName, Agent } from "./types.ts";
import type { Project } from "./types.ts";
import { claudeCodeAgent } from "./lib/agents/claude-code.ts";
import { codexAgent } from "./lib/agents/codex.ts";

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

export const agents: Record<AgentName, Agent> = {
  "claude-code": claudeCodeAgent,
  codex: codexAgent,
};
