import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

describe('published declarations', () => {
  const builderDocgenPackages = Object.keys(BUILDER_DOCGEN_PACKAGES);
  const listDts = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? listDts(join(dir, entry.name))
        : entry.name.endsWith('.d.ts')
          ? [join(dir, entry.name)]
          : []
    );

  // An optional peer may be missing, so a `.d.ts` that imports one fails `tsc` with TS2307 in
  // projects that type-check their `.storybook/main.ts` without `skipLibCheck`.
  it.each(['renderers/react', 'frameworks/react-vite', 'presets/react-webpack'])(
    'of %s do not import the builder docgen packages',
    (dir) => {
      const dist = join(CODE_DIR, dir, 'dist');
      const files = existsSync(dist) ? listDts(dist) : [];
      for (const file of files) {
        const source = readFileSync(file, 'utf-8');
        for (const name of builderDocgenPackages) {
          expect(source, `${file} imports ${name}`).not.toMatch(
            new RegExp(`from ['"]${name.replace('/', '\\/')}['"]`)
          );
        }
      }
    }
  );
});
