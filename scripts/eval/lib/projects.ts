export interface Project {
  name: string;
  repo: string;
  branch: string;
  githubSlug: string;
  projectDir?: string;
  description?: string;
}

export const PROJECTS: Project[] = [
  {
    name: 'mealdrop',
    repo: 'https://github.com/storybook-tmp/mealdrop',
    branch: 'main',
    githubSlug: 'storybook-tmp/mealdrop',
    description: 'Styled components, Redux, React Router',
  },
  {
    name: 'edgy',
    repo: 'https://github.com/storybook-tmp/edgy',
    branch: 'main',
    githubSlug: 'storybook-tmp/edgy',
    description: 'Tailwind, HeadlessUI, React Router',
  },
  {
    name: 'wikitok',
    repo: 'https://github.com/storybook-tmp/wikitok',
    branch: 'main',
    githubSlug: 'storybook-tmp/wikitok',
    projectDir: 'frontend',
    description: 'Simple project with Tailwind',
  },
  {
    name: 'baklava',
    repo: 'https://github.com/storybook-tmp/baklava',
    branch: 'main',
    githubSlug: 'storybook-tmp/baklava',
    description: 'Component library with Zustand',
  },
  {
    name: 'echarts',
    repo: 'https://github.com/storybook-tmp/echarts-react',
    branch: 'main',
    githubSlug: 'storybook-tmp/echarts-react',
    description: 'ECharts React wrapper',
  },
];
