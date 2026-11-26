import { readFile, readdir } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { join } from 'pathe';

import {
  builderPackages,
  frameworkRegistry,
  frameworkToRenderer,
  rendererPackages,
} from './framework.ts';

const codeDir = join(import.meta.dirname, '../../../..');

const packageNamesIn = async (dir: string) => {
  const entries = await readdir(join(codeDir, dir), { withFileTypes: true });
  const names = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const packageJson = await readFile(join(codeDir, dir, entry.name, 'package.json'), 'utf-8')
          .then((content) => JSON.parse(content) as { name: string })
          .catch(() => undefined);
        return packageJson ? { dir: entry.name, name: packageJson.name } : undefined;
      })
  );
  return names.filter((entry) => entry !== undefined);
};

describe('frameworkRegistry', () => {
  it('names the package of every framework in the monorepo under its folder name', async () => {
    const frameworks = await packageNamesIn('frameworks');

    expect(frameworks.length).toBeGreaterThan(0);
    for (const { dir, name } of frameworks) {
      expect(frameworkRegistry[dir as keyof typeof frameworkRegistry]?.packageName).toBe(name);
    }
  });

  it('names the package of every renderer in the monorepo', async () => {
    const renderers = await packageNamesIn('renderers');

    expect(renderers.length).toBeGreaterThan(0);
    for (const { name } of renderers) {
      expect(rendererPackages).toHaveProperty([name]);
    }
  });

  it('names the package of every builder in the monorepo', async () => {
    const builders = await packageNamesIn('builders');

    expect(builders.length).toBeGreaterThan(0);
    for (const { name } of builders) {
      expect(builderPackages).toHaveProperty([name]);
    }
  });

  it('gives each framework its own package', () => {
    const packageNames = Object.values(frameworkRegistry).map(({ packageName }) => packageName);

    expect(new Set(packageNames).size).toBe(packageNames.length);
  });
});

describe('frameworkToRenderer', () => {
  it('prefers a framework over a renderer of the same name', () => {
    expect(frameworkToRenderer.nuxt).toBe('vue3');
  });

  it('maps a renderer used as its own framework to itself', () => {
    expect(frameworkToRenderer['react-native']).toBe('react-native');
  });
});
