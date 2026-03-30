export interface Project {
  name: string;
  repo: string;
  branch: string;
  projectDir?: string;
  description?: string;
}

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
