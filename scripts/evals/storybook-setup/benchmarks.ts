import type { BenchmarkProject } from './types';

export const BENCHMARKS: BenchmarkProject[] = [
  {
    id: 'mealdrop',
    name: 'MealDrop',
    repo: 'https://github.com/yannbf/mealdrop',
    branch: 'without-storybook',
    description:
      'React app with styled-components, Redux, and react-router-dom. Useful for provider and global-style setup.',
    tags: ['react', 'vite', 'styled-components', 'redux', 'router'],
  },
  {
    id: 'edgy',
    name: 'Edgy',
    repo: 'https://github.com/catherineisonline/edgy',
    description:
      'React app with Tailwind CSS, Headless UI, and react-router-dom. Useful for CSS pipeline and router decorators.',
    tags: ['react', 'vite', 'tailwind', 'headlessui', 'router'],
  },
  {
    id: 'wikitok',
    name: 'Wikitok',
    repo: 'https://github.com/IsaacGemal/wikitok',
    projectDir: 'frontend',
    description: 'Nested frontend app with Tailwind CSS. Useful for monorepo-ish project-dir handling.',
    tags: ['react', 'vite', 'tailwind', 'nested-project'],
  },
  {
    id: 'baklava',
    name: 'baklava',
    repo: 'https://github.com/fortanix/baklava',
    branch: 'master',
    description: 'Component library with Zustand state. Useful for library-style story authoring.',
    tags: ['react', 'component-library', 'zustand'],
  },
  {
    id: 'echarts-react',
    name: 'echarts',
    repo: 'https://github.com/tmkx/echarts-react',
    description: 'React wrapper around ECharts. Useful for third-party rendering dependencies.',
    tags: ['react', 'library', 'echarts'],
  },
  {
    id: 'evergreen-ci',
    name: 'Evergreen CI',
    repo: 'https://github.com/evergreen-ci/ui',
    projectDir: 'packages/lib',
    description:
      'Large workspace package with GraphQL and application providers. Useful for nested-package and provider-heavy setup.',
    tags: ['react', 'workspace', 'graphql', 'nested-project'],
  },
];

export function getBenchmarkById(id: string) {
  const benchmark = BENCHMARKS.find((entry) => entry.id === id);
  if (!benchmark) {
    throw new Error(`Unknown benchmark "${id}".`);
  }

  return benchmark;
}
