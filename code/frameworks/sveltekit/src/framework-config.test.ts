import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { vol, fs as memfs } from 'memfs';
import { beforeEach, expect, it, vi } from 'vitest';

import { sveltekitStaticDirs } from './framework-config.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(memfs.existsSync);
});

it.each<{
  name: string;
  files: Record<string, string>;
  production: boolean;
  expected: { from: string; to: string }[];
}>([
  {
    name: "contributes SvelteKit's static directory at the root in production",
    files: { '/project/static/robots.txt': '' },
    production: true,
    expected: [{ from: resolve('/project/static'), to: '/' }],
  },
  {
    name: 'contributes nothing when the project has no static directory',
    files: {},
    production: true,
    expected: [],
  },
  {
    name: 'contributes nothing in dev mode, where Vite serves the static directory',
    files: { '/project/static/robots.txt': '' },
    production: false,
    expected: [],
  },
])('$name', ({ files, production, expected }) => {
  vol.fromNestedJSON(files);

  expect(sveltekitStaticDirs({ configDir: '/project/.storybook', production })).toEqual(expected);
});
