import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { allTemplates } from '../code/lib/cli-storybook/src/sandbox-templates.ts';
import { CODE_DIRECTORY } from './utils/constants.ts';

const subdirectories = (dir: string) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

// Pre-existing on `next`: no Angular template loads these, so their stories never run.
const knownOrphanStoriesFolders = [
  '@storybook/angular-vite/stories_angular-cli-default-ts',
  '@storybook/angular-vite/stories_angular-cli-prerelease',
  '@storybook/angular/stories_angular-cli-prerelease',
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
