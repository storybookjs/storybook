import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { expect, it } from 'vitest';

import { allTemplates } from '../code/lib/cli-storybook/src/sandbox-templates.ts';
import { sandboxDependencies, sandboxProjects } from './create-nx-sandbox-projects.ts';

const ROOT = join(import.meta.dirname, '..');

// `nx affected` runs a sandbox's tasks only when a project it depends on changes, so a stale
// project.json silently skips them. Regenerate with `cd scripts && yarn exec jiti
// create-nx-sandbox-projects.ts`.
it('keeps the sandbox projects as the generator writes them', () => {
  for (const [path, data] of sandboxProjects()) {
    expect(JSON.parse(readFileSync(join(ROOT, path), 'utf8')), path).toEqual(JSON.parse(data));
  }
});

it('makes each sandbox depend on the workspace packages its template installs', () => {
  expect(sandboxDependencies(allTemplates['react-vite/default-ts'])).toEqual(
    expect.arrayContaining(['core', 'react-vite', 'react', 'builder-vite', 'addon-mcp', 'mcp'])
  );
  // A community framework from npm, on this repository's renderer.
  expect(sandboxDependencies(allTemplates['vue3-rsbuild/default-ts'])).toContain('vue3');
});
