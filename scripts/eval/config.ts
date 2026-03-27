import type { Project, AgentName, Agent } from './types';
import { claudeCodeAgent } from './lib/agents/claude-code';
import { copilotAgent } from './lib/agents/copilot';

export const PROJECTS: Project[] = [
  {
    name: 'mealdrop',
    repo: 'https://github.com/yannbf/mealdrop',
    branch: 'without-storybook',
    description: 'Styled components, Redux, React Router',
  },
  {
    name: 'edgy',
    repo: 'https://github.com/catherineisonline/edgy',
    description: 'Tailwind, HeadlessUI, React Router',
  },
  {
    name: 'wikitok',
    repo: 'https://github.com/IsaacGemal/wikitok',
    projectDir: 'frontend',
    description: 'Simple project with Tailwind',
  },
  {
    name: 'baklava',
    repo: 'https://github.com/fortanix/baklava',
    branch: 'master',
    description: 'Component library with Zustand',
  },
  {
    name: 'echarts',
    repo: 'https://github.com/tmkx/echarts-react',
    description: 'ECharts React wrapper',
  },
  {
    name: 'evergreen-ci',
    repo: 'https://github.com/evergreen-ci/ui',
    projectDir: 'packages/lib',
    description: 'GraphQL',
  },
];

export const agents: Record<AgentName, Agent> = {
  'claude-code': claudeCodeAgent,
  'copilot-cli': copilotAgent,
};

export const DEFAULT_AGENT: AgentName = 'claude-code';
export const DEFAULT_MODEL = 'claude-sonnet-4-6' as const;
