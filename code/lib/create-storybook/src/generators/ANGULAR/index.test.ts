import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { SupportedBuilder } from 'storybook/internal/types';

import type { GeneratorContext } from '../types.ts';

import { vol } from 'memfs';

import angularGenerator from './index.ts';

// Spy-only mock: `AngularJSON` (via `storybook/internal/cli`) and this generator read and write
// `angular.json` and `.storybook` synchronously. Redirect just those calls to `memfs`.
vi.mock('node:fs', { spy: true });

// Copies real template files off disk, which memfs cannot see and this test does not exercise.
vi.mock('storybook/internal/cli', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/cli')>()),
  copyTemplate: vi.fn(),
}));

const ANGULAR_JSON = JSON.stringify({
  version: 1,
  projects: {
    'my-app': { root: '', projectType: 'application', architect: { build: {} } },
  },
});

const createPackageManager = (angularCore: { declared: string | null; resolved: string | null }) =>
  ({
    // The raw package.json specifier, and the package manager's resolution of it (installed
    // version first, then a pnpm catalog lookup): the same split the real implementations have.
    getDependencyVersion: vi.fn().mockReturnValue(angularCore.declared),
    getDeclaredVersionSpecifier: vi.fn().mockResolvedValue(angularCore.resolved),
    addScripts: vi.fn(),
  }) as unknown as JsPackageManager;

const configure = (
  angularCore: { declared: string | null; resolved: string | null },
  builder: SupportedBuilder = SupportedBuilder.VITE
) =>
  angularGenerator.configure(createPackageManager(angularCore), {
    builder,
    yes: true,
    telemetryService: { trackPromptCancel: vi.fn() },
  } as unknown as GeneratorContext);

describe('ANGULAR generator', () => {
  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');

    vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
    vi.mocked(readFileSync).mockImplementation(memfs.fs.readFileSync as typeof readFileSync);
    vi.mocked(writeFileSync).mockImplementation(memfs.fs.writeFileSync as typeof writeFileSync);
    vi.mocked(rmSync).mockImplementation(memfs.fs.rmSync as typeof rmSync);

    vol.fromJSON({ [`${process.cwd()}/angular.json`]: ANGULAR_JSON });
  });

  afterEach(() => {
    vol.reset();
  });

  // `semver.minVersion` throws `Invalid comparator` on these, and the generator ran it on the raw
  // package.json specifier with nothing to catch it, so `storybook init` died outright on any
  // Angular monorepo that pins through a catalog or the workspace protocol.
  it.each(['catalog:angular', 'catalog:', 'workspace:*', 'workspace:^'])(
    'resolves an @angular/core pinned as %s instead of crashing',
    async (declared) => {
      const { extraPackages } = await configure({ declared, resolved: '21.2.19' });

      expect(extraPackages).toContain('@angular-devkit/build-angular@21.2.19');
      expect(extraPackages).toContain('@angular-devkit/architect@0.2102.19');
    }
  );

  // The raw specifier used to reach the install list as-is, asking the package manager for
  // `@angular-devkit/build-angular@catalog:angular`.
  it('never pins an added package to a specifier that is not a version', async () => {
    const { extraPackages } = await configure({ declared: 'catalog:angular', resolved: null });

    expect(extraPackages).not.toContainEqual(expect.stringContaining('catalog:'));
    expect(extraPackages).toContain('@angular-devkit/build-angular');
  });

  // Pin: a plain range already worked, and the added packages should keep mirroring the range the
  // project declares rather than dropping to the exact version that happens to be installed.
  it('mirrors a declared caret range onto the packages it adds', async () => {
    const { extraPackages } = await configure({ declared: '^21.2.0', resolved: '21.2.19' });

    expect(extraPackages).toContain('@angular-devkit/build-angular@^21.2.0');
    expect(extraPackages).toContain('@angular-devkit/architect@^0.2102.0');
  });

  // `@analogjs/vite-plugin-angular` requires `@angular/build/private` on every Angular this
  // framework supports, and marks the peer optional, so nothing ever asked for it.
  it('adds @angular/build on the Vite builder, pinned to the detected Angular version', async () => {
    const { extraPackages } = await configure({ declared: '^21.2.0', resolved: '21.2.19' });

    expect(extraPackages).toContain('@angular/build@^21.2.0');
  });

  // Pin, not a regression test: neither builder added `@angular/build` before this fix, so it
  // passed vacuously. `@storybook/angular` builds with `@angular-devkit/build-angular` and never
  // loads `@angular/build`, so the Webpack builder must not drag a second Angular toolchain in.
  it('does not add @angular/build on the Webpack builder', async () => {
    const { extraPackages } = await configure(
      { declared: '^21.2.0', resolved: '21.2.19' },
      SupportedBuilder.WEBPACK5
    );

    expect(extraPackages).not.toContain('@angular/build@^21.2.0');
    expect(extraPackages).not.toContain('@angular/build');
  });
});
