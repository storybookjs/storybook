import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { allTemplates } from '../code/lib/cli-storybook/src/sandbox-templates.ts';
import { CODE_DIRECTORY } from './utils/constants.ts';
import {
  sandboxDependencies,
  sandboxProjects,
  unhashedSandboxPackages,
} from './create-nx-sandbox-projects.ts';

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

it('finds the workspace packages a sandbox installs that its project does not reach', () => {
  expect(
    unhashedSandboxPackages(allTemplates['react-vite/default-ts'], [
      'storybook',
      '@storybook/react-vite',
      // Through @storybook/cli.
      'create-storybook',
      '@storybook/addon-mcp',
      'react',
      'eslint-plugin-storybook',
      '@storybook/addon-themes',
    ])
  ).toEqual(['eslint-plugin-storybook', '@storybook/addon-themes']);
});

const subdirectories = (dir: string) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

// The angular-vite templates load `stories_angular-vite-*`, so these stories never run in a sandbox.
const knownOrphanStoriesFolders = [
  '@storybook/angular-vite/stories_angular-cli-default-ts',
  '@storybook/angular-vite/stories_angular-cli-prerelease',
];

describe('sandbox templates', () => {
  it('have exactly one NX project each under code/sandbox', () => {
    const projects = subdirectories(join(CODE_DIRECTORY, 'sandbox')).sort();
    const keys = Object.keys(allTemplates)
      .map((key) => key.replaceAll('/', '-'))
      .sort();

    expect(projects).toEqual(keys);
  });

  it('load every template/stories_* folder in the renderer and framework packages', () => {
    const loaded = Object.entries(allTemplates).flatMap(([key, template]) => {
      const variant = template.modifications?.storiesVariant ?? key.replaceAll('/', '-');
      return [template.expected.renderer, template.expected.framework].map(
        (packageName) => `${packageName}/stories_${variant}`
      );
    });

    const orphans = ['renderers', 'frameworks', 'addons'].flatMap((group) =>
      subdirectories(join(CODE_DIRECTORY, group)).flatMap((dir) => {
        const packageDir = join(CODE_DIRECTORY, group, dir);
        const templateDir = join(packageDir, 'template');
        if (!existsSync(templateDir)) {
          return [];
        }
        const { name } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf-8'));
        return subdirectories(templateDir)
          .filter((folder) => folder.startsWith('stories_'))
          .map((folder) => `${name}/${folder}`)
          .filter((folder) => !loaded.includes(folder));
      })
    );

    expect(orphans.sort()).toEqual(knownOrphanStoriesFolders);
  });
});
