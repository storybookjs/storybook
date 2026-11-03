import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BUILDER_DOCGEN_PACKAGES,
  getAddBuilderDocgenPackagesCommand,
} from './builder-docgen-packages.ts';
import { PackageManagerName } from '../js-package-manager/JsPackageManager.ts';

const CODE_DIR = join(__dirname, '..', '..', '..', '..');

const readPackageJson = (dir: string) =>
  JSON.parse(readFileSync(join(CODE_DIR, dir, 'package.json'), 'utf-8')) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };

describe('BUILDER_DOCGEN_PACKAGES', () => {
  it.each([
    ['renderers/react', ['react-docgen', 'react-docgen-typescript']],
    [
      'frameworks/react-vite',
      [
        'react-docgen',
        'react-docgen-typescript',
        '@joshwooding/vite-plugin-react-docgen-typescript',
      ],
    ],
    [
      'presets/react-webpack',
      ['react-docgen', 'react-docgen-typescript', '@storybook/react-docgen-typescript-plugin'],
    ],
  ] as const)('match the optional peer dependencies of %s', (dir, packages) => {
    const packageJson = readPackageJson(dir);

    for (const name of packages) {
      expect(packageJson.dependencies?.[name], name).toBeUndefined();
      expect(packageJson.peerDependencies?.[name], name).toBe(BUILDER_DOCGEN_PACKAGES[name]);
      expect(packageJson.peerDependenciesMeta?.[name]?.optional, name).toBe(true);
    }
  });
});

describe('getAddBuilderDocgenPackagesCommand', () => {
  it.each([
    [PackageManagerName.NPM, 'npm install -D "react-docgen@^8.0.2"'],
    [PackageManagerName.YARN2, 'yarn add -D "react-docgen@^8.0.2"'],
    [PackageManagerName.PNPM, 'pnpm add -D "react-docgen@^8.0.2"'],
    [PackageManagerName.BUN, 'bun add -D "react-docgen@^8.0.2"'],
  ])('builds the %s command', (packageManager, command) => {
    expect(getAddBuilderDocgenPackagesCommand(['react-docgen'], packageManager)).toBe(command);
  });

  it('leaves a specifier without range characters unquoted', () => {
    expect(
      getAddBuilderDocgenPackagesCommand(
        ['@storybook/react-docgen-typescript-plugin'],
        PackageManagerName.NPM
      )
    ).toBe('npm install -D @storybook/react-docgen-typescript-plugin@1.0.6--canary.9.0c3f3b7.0');
  });
});
