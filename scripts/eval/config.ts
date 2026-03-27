import type { Project, AgentName, Agent } from './types';
import { claudeCodeAgent } from './lib/agents/claude-code';
import { codexAgent } from './lib/agents/codex';

/**
 * Pre-prepared eval baseline repos.
 *
 * Each repo is a fork with an `eval-baseline` branch where:
 * - Storybook files were cleaned
 * - `npx storybook@latest init --yes --no-dev` was run
 * - All deps installed and committed
 *
 * To regenerate: `npx jiti scripts/eval/prepare-repos.ts`
 */
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

export const agents: Record<AgentName, Agent> = {
  'claude-code': claudeCodeAgent,
  codex: codexAgent,
};

export const DEFAULT_AGENT: AgentName = 'claude-code';
export const DEFAULT_MODEL = 'claude-sonnet-4-6' as const;
