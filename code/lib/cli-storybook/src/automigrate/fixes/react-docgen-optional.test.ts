import { describe, expect, it, vi } from 'vitest';

import { createRequire } from 'node:module';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { checkFix } from '../helpers/fix-test-utils.ts';
import { reactDocgenOptional } from './react-docgen-optional.ts';

vi.mock('node:module', { spy: true });

// pnpm layout: the project resolves only the framework, which resolves `@storybook/react`.
const makePackageManager = ({ declared = [] as string[], typescript = false }) => {
  const links: Record<string, Record<string, string>> = {
    '/project/package.json': {
      '@storybook/react-vite/package.json': '/pnpm/react-vite/package.json',
    },
    '/pnpm/react-vite/package.json': {
      '@storybook/react/package.json': '/pnpm/react/package.json',
    },
    '/pnpm/react/package.json': typescript ? { typescript: '/pnpm/typescript/index.js' } : {},
  };
  vi.mocked(createRequire).mockImplementation(
    (from) =>
      ({
        resolve: (id: string) => {
          const resolved = links[String(from)]?.[id];
          if (!resolved) {
            throw new Error(`Cannot find module '${id}'`);
          }
          return resolved;
        },
      }) as unknown as NodeJS.Require
  );
  return {
    instanceDir: '/project',
    isDependencyInstalled: (name: string) => declared.includes(name),
    addDependencies: vi.fn(),
  } as unknown as JsPackageManager;
};

const check = (
  mainConfig: Partial<StorybookConfigRaw>,
  packages: Parameters<typeof makePackageManager>[0] = {}
) =>
  checkFix(reactDocgenOptional, {
    packageManager: makePackageManager(packages),
    mainConfig: { stories: [], framework: '@storybook/react-vite', ...mainConfig },
    storybookVersion: '11.0.0',
    storiesPaths: [],
  });

describe('react-docgen-optional', () => {
  it('is offered to a JavaScript project', async () => {
    expect(await check({})).toEqual({});
  });

  it('is offered to a TypeScript project that turned docgen server off', async () => {
    expect(await check({ features: { docgenServer: false } }, { typescript: true })).toEqual({});
  });

  it.each<[string, Partial<StorybookConfigRaw>, Parameters<typeof makePackageManager>[0]]>([
    ['react-docgen is declared', {}, { declared: ['react-docgen'] }],
    ['reactDocgen is false', { typescript: { reactDocgen: false } as any }, {}],
    ['docgen server documents the components', {}, { typescript: true }],
    ['the renderer is not React', { framework: '@storybook/vue3-vite' }, {}],
  ])('is not offered when %s', async (_name, mainConfig, packages) => {
    expect(await check(mainConfig, packages)).toBeNull();
  });

  it('adds react-docgen as a devDependency', async () => {
    const packageManager = makePackageManager({});

    await reactDocgenOptional.run!({ packageManager, result: {} } as any);

    expect(packageManager.addDependencies).toHaveBeenCalledWith(
      { type: 'devDependencies', skipInstall: true },
      ['react-docgen@^8.0.2']
    );
  });
});
