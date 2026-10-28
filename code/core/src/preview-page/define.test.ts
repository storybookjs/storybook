import { afterEach, expect, it, vi } from 'vitest';

import { getPreviewDefine } from './define.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

const ENV = {
  STORYBOOK: 'true',
  STORYBOOK_API: 'https://example.com',
  VITE_KEY: 'v',
  NODE_ENV: 'test',
};

it.each([
  {
    name: 'process.env',
    target: { env: 'process.env' },
    developmentModeForBuild: false,
    expected: {
      'process.env': `({"STORYBOOK":"true","STORYBOOK_API":"https://example.com","VITE_KEY":"v","NODE_ENV":"test"})`,
      'process.env.STORYBOOK': '"true"',
      'process.env.STORYBOOK_API': '"https://example.com"',
      'process.env.VITE_KEY': '"v"',
      'process.env.NODE_ENV': '"test"',
      NODE_ENV: '"production"',
    },
  },
  {
    name: 'process.env in development mode for build',
    target: { env: 'process.env' },
    developmentModeForBuild: true,
    expected: {
      'process.env': `({"STORYBOOK":"true","STORYBOOK_API":"https://example.com","VITE_KEY":"v","NODE_ENV":"test"})`,
      'process.env.STORYBOOK': '"true"',
      'process.env.STORYBOOK_API': '"https://example.com"',
      'process.env.VITE_KEY': '"v"',
      'process.env.NODE_ENV': '"test"',
      NODE_ENV: '"development"',
    },
  },
  {
    name: 'import.meta.env without a prefix',
    target: { env: 'import.meta.env' },
    developmentModeForBuild: false,
    expected: {
      'import.meta.env.STORYBOOK': '"true"',
      'import.meta.env': '{"STORYBOOK":"\\"true\\""}',
    },
  },
  {
    name: 'import.meta.env with a prefix',
    target: { env: 'import.meta.env', envPrefix: 'STORYBOOK_' },
    developmentModeForBuild: false,
    expected: {
      'import.meta.env.STORYBOOK': '"true"',
      'import.meta.env.STORYBOOK_API': '"https://example.com"',
      'import.meta.env': '{"STORYBOOK":"\\"true\\"","STORYBOOK_API":"\\"https://example.com\\""}',
    },
  },
  {
    name: 'import.meta.env with prefixes in development mode for build',
    target: { env: 'import.meta.env', envPrefix: ['VITE_', 'STORYBOOK_'] },
    developmentModeForBuild: true,
    expected: {
      'import.meta.env.STORYBOOK': '"true"',
      'import.meta.env.STORYBOOK_API': '"https://example.com"',
      'import.meta.env.VITE_KEY': '"v"',
      'import.meta.env':
        '{"STORYBOOK":"\\"true\\"","STORYBOOK_API":"\\"https://example.com\\"","VITE_KEY":"\\"v\\""}',
      'process.env.NODE_ENV': '"development"',
    },
  },
] as const)('defines $name', ({ target, developmentModeForBuild, expected }) => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(getPreviewDefine({ env: ENV, developmentModeForBuild }, target)).toEqual(expected);
});
