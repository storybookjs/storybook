import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  REACT_DOCGEN_FALLBACK_RANGE,
  checkBuilderDocgenPackages,
  getTypeScriptForDocgenError,
} from 'storybook/internal/common';
import { TypeScriptWithoutCompilerApiError } from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';

import { REACT_BUILDER_DOCGEN_PACKAGES, prepareReactBuilderDocgen } from './builder-docgen.ts';

vi.mock('storybook/internal/common', { spy: true });

const CODE_DIR = join(import.meta.dirname, '..', '..', '..');

const readPackageJson = (dir: string) =>
  JSON.parse(readFileSync(join(CODE_DIR, dir, 'package.json'), 'utf-8')) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };

const VITE_PEERS = [
  'react-docgen',
  'react-docgen-typescript',
  '@joshwooding/vite-plugin-react-docgen-typescript',
] as const;
const WEBPACK_PEERS = [
  'react-docgen',
  'react-docgen-typescript',
  '@storybook/react-docgen-typescript-plugin',
] as const;

describe('REACT_BUILDER_DOCGEN_PACKAGES', () => {
  it.each([
    ['renderers/react', ['react-docgen', 'react-docgen-typescript']],
    ['frameworks/react-vite', VITE_PEERS],
    ['presets/react-webpack', WEBPACK_PEERS],
    // Frameworks pass the peers through, because strict package managers (Yarn with the pnpm
    // linker or PnP) only give a package the peers its direct parent provides.
    ['frameworks/nextjs-vite', VITE_PEERS],
    ['frameworks/react-native-web-vite', VITE_PEERS],
    ['frameworks/tanstack-react', VITE_PEERS],
    ['frameworks/nextjs', WEBPACK_PEERS],
    ['frameworks/react-webpack5', WEBPACK_PEERS],
  ] as const)('match the optional peer dependencies of %s', (dir, packages) => {
    const packageJson = readPackageJson(dir);

    for (const name of packages) {
      expect(packageJson.dependencies?.[name], name).toBeUndefined();
      expect(packageJson.peerDependencies?.[name], name).toBe(REACT_BUILDER_DOCGEN_PACKAGES[name]);
      expect(packageJson.peerDependenciesMeta?.[name]?.optional, name).toBe(true);
    }
  });

  // TEMPORARY(ts-7.1): see `typescript-7-react-docgen-fallback.ts` in core.
  it('match the react-docgen that init and upgrade add on TypeScript 7.0', () => {
    expect(REACT_DOCGEN_FALLBACK_RANGE).toBe(REACT_BUILDER_DOCGEN_PACKAGES['react-docgen']);
  });
});

describe('builder docgen helpers', () => {
  // Only builder docgen uses these, so the packages bundle them into their lazy docgen code.
  it.each([
    ['frameworks/react-vite', ['@rollup/pluginutils', 'magic-string', 'resolve', 'tsconfig-paths']],
    ['presets/react-webpack', ['magic-string', 'resolve', 'tsconfig-paths']],
  ] as const)('are bundled into %s instead of installed', (dir, helpers) => {
    const packageJson = readPackageJson(dir);
    for (const name of helpers) {
      expect(packageJson.dependencies?.[name], name).toBeUndefined();
    }
  });
});

describe('built output', () => {
  const listFiles = (dir: string, extension: string): string[] =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory()
            ? listFiles(join(dir, entry.name), extension)
            : entry.name.endsWith(extension)
              ? [join(dir, entry.name)]
              : []
        )
      : [];

  // An optional peer may be missing, so a `.d.ts` that imports one fails `tsc` with TS2307 in
  // projects that type-check their `.storybook/main.ts` without `skipLibCheck`.
  it.each(['renderers/react', 'frameworks/react-vite', 'presets/react-webpack'])(
    'of %s has declarations that import no builder docgen package',
    (dir) => {
      const files = listFiles(join(CODE_DIR, dir, 'dist'), '.d.ts');
      // Locally the packages may not be built yet; CI builds them before unit tests.
      if (process.env.CI) {
        expect(files.length, `${dir} has no built declarations`).toBeGreaterThan(0);
      }
      for (const file of files) {
        const source = readFileSync(file, 'utf-8');
        for (const name of Object.keys(REACT_BUILDER_DOCGEN_PACKAGES)) {
          expect(source, `${file} imports ${name}`).not.toMatch(
            new RegExp(`(from |import\\()['"]${name.replace('/', '\\/')}['"]`)
          );
        }
      }
    }
  );

  it('keeps the builder docgen code out of the React Vite preset entry', () => {
    const preset = join(CODE_DIR, 'frameworks/react-vite/dist/preset.js');
    if (!existsSync(preset)) {
      expect(process.env.CI, 'the React Vite preset is built in CI').toBeFalsy();
      return;
    }
    const staticImports = readFileSync(preset, 'utf-8')
      .split('\n')
      .filter((line) => /^import\s/.test(line))
      .join('\n');
    expect(staticImports).not.toMatch(/react-docgen|magic-string|tsconfig-paths|pluginutils/);
  });
});

describe('prepareReactBuilderDocgen', () => {
  const options = {
    configDir: '/project/.storybook',
    presets: { apply: async () => ({}) } as unknown as Options['presets'],
  };
  const resolve = (specifier: string) => specifier;

  beforeEach(() => {
    vi.mocked(checkBuilderDocgenPackages).mockResolvedValue([]);
    vi.mocked(getTypeScriptForDocgenError).mockReturnValue(undefined);
  });

  it.each([
    ['react-docgen', 'vite', { 'react-docgen': '^8.0.2' }],
    [
      'react-docgen-typescript',
      'vite',
      {
        '@joshwooding/vite-plugin-react-docgen-typescript': '^0.7.0',
        'react-docgen-typescript': '^2.2.2',
      },
    ],
    [
      'react-docgen-typescript',
      'webpack',
      {
        '@storybook/react-docgen-typescript-plugin': '1.0.6--canary.9.0c3f3b7.0',
        'react-docgen-typescript': '^2.2.2',
      },
    ],
  ] as const)('checks the %s packages for %s', async (reactDocgen, builder, packages) => {
    await expect(
      prepareReactBuilderDocgen({ reactDocgen, builder, resolve, options })
    ).resolves.toBe(reactDocgen);
    expect(checkBuilderDocgenPackages).toHaveBeenCalledWith(
      expect.objectContaining({
        packages,
        builderDocgen: `typescript.reactDocgen: '${reactDocgen}'`,
        disableBuilderDocgen: 'typescript.reactDocgen: false',
        apis: ['compiler', 'native'],
      })
    );
  });

  describe('without a usable typescript', () => {
    beforeEach(() => {
      vi.mocked(getTypeScriptForDocgenError).mockReturnValue(
        new TypeScriptWithoutCompilerApiError({ version: '7.0.2' })
      );
    });

    it('falls back from react-docgen-typescript to react-docgen, and says why', async () => {
      await expect(
        prepareReactBuilderDocgen({
          reactDocgen: 'react-docgen-typescript',
          builder: 'vite',
          resolve,
          options,
        })
      ).resolves.toBe('react-docgen');
      const [{ packages, note }] = vi.mocked(checkBuilderDocgenPackages).mock.calls[0];
      expect(packages).toEqual({ 'react-docgen': '^8.0.2' });
      expect(note).toContain('TypeScript compiler API');
    });
  });

  describe('when packages are missing', () => {
    beforeEach(() => {
      vi.mocked(checkBuilderDocgenPackages).mockResolvedValue(['react-docgen']);
    });

    it('tells the preset not to run builder docgen', async () => {
      await expect(
        prepareReactBuilderDocgen({
          reactDocgen: 'react-docgen',
          builder: 'vite',
          resolve,
          options,
        })
      ).resolves.toBeUndefined();
    });
  });
});
