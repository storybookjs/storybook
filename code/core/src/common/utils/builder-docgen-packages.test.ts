import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BUILDER_DOCGEN_PACKAGES,
  findPackageManagerForInstallHint,
  getAddBuilderDocgenPackagesCommand,
  isBuilderDocgenPackageInstalled,
  isPnpmWorkspaceRoot,
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
    // Frameworks pass the peers through, because strict package managers (Yarn with the pnpm
    // linker or PnP) only give a package the peers its direct parent provides.
    [
      'frameworks/nextjs-vite',
      [
        'react-docgen',
        'react-docgen-typescript',
        '@joshwooding/vite-plugin-react-docgen-typescript',
      ],
    ],
    [
      'frameworks/react-native-web-vite',
      [
        'react-docgen',
        'react-docgen-typescript',
        '@joshwooding/vite-plugin-react-docgen-typescript',
      ],
    ],
    [
      'frameworks/tanstack-react',
      [
        'react-docgen',
        'react-docgen-typescript',
        '@joshwooding/vite-plugin-react-docgen-typescript',
      ],
    ],
    [
      'frameworks/nextjs',
      ['react-docgen', 'react-docgen-typescript', '@storybook/react-docgen-typescript-plugin'],
    ],
    [
      'frameworks/react-webpack5',
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
      // Locally the packages may not be built yet; CI builds them before unit tests.
      if (process.env.CI) {
        expect(files.length, `${dir} has no built declarations`).toBeGreaterThan(0);
      }
      for (const file of files) {
        const source = readFileSync(file, 'utf-8');
        for (const name of builderDocgenPackages) {
          expect(source, `${file} imports ${name}`).not.toMatch(
            new RegExp(`(from |import\\()['"]${name.replace('/', '\\/')}['"]`)
          );
        }
      }
    }
  );
});

describe('findPackageManagerForInstallHint', () => {
  const project = (files: string[]) => {
    const root = mkdtempSync(join(tmpdir(), 'sb-install-hint-'));
    for (const file of files) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), '');
    }
    return root;
  };

  it('uses the closest lockfile', () => {
    const root = project(['yarn.lock', 'apps/web/pnpm-lock.yaml']);

    expect(
      findPackageManagerForInstallHint({ cwd: join(root, 'apps/web'), last: root, userAgent: '' })
    ).toBe(PackageManagerName.PNPM);
  });

  it('falls back to the user agent, then to npm', () => {
    const root = project([]);

    expect(
      findPackageManagerForInstallHint({ cwd: root, last: root, userAgent: 'bun/1.2.0 npm/?' })
    ).toBe(PackageManagerName.BUN);
    expect(findPackageManagerForInstallHint({ cwd: root, last: root, userAgent: '' })).toBe(
      PackageManagerName.NPM
    );
  });
});

describe('isBuilderDocgenPackageInstalled', () => {
  const resolveTo = (version: string | undefined) => (specifier: string) => {
    if (!version) {
      throw Object.assign(new Error(`Cannot find package '${specifier}'`), {
        code: 'ERR_MODULE_NOT_FOUND',
      });
    }
    const dir = mkdtempSync(join(tmpdir(), 'sb-docgen-package-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: specifier, version }));
    return pathToFileURL(join(dir, 'dist', 'main.js')).href;
  };

  it('accepts a version in the peer range', () => {
    expect(isBuilderDocgenPackageInstalled(resolveTo('8.0.4'), 'react-docgen')).toBe(true);
  });

  it('rejects an older major that another dependency hoisted', () => {
    expect(isBuilderDocgenPackageInstalled(resolveTo('5.4.3'), 'react-docgen')).toBe(false);
  });

  it('rejects a package that does not resolve', () => {
    expect(isBuilderDocgenPackageInstalled(resolveTo(undefined), 'react-docgen')).toBe(false);
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

  it('stay out of the React Vite preset entry, which loads them lazily', () => {
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

describe('isPnpmWorkspaceRoot', () => {
  it('is true only in the package at the workspace root', () => {
    const root = mkdtempSync(join(tmpdir(), 'sb-pnpm-workspace-'));
    mkdirSync(join(root, 'apps/web'), { recursive: true });
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: [apps/*]');
    writeFileSync(join(root, 'package.json'), '{}');
    writeFileSync(join(root, 'apps/web/package.json'), '{}');

    expect(isPnpmWorkspaceRoot(root)).toBe(true);
    expect(isPnpmWorkspaceRoot(join(root, 'apps/web'))).toBe(false);
  });
});
