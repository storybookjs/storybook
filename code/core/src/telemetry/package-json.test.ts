import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getActualPackageJson, getActualPackageVersion } from './package-json.ts';

describe('getActualPackageJson', () => {
  let projectDir: string;

  const addPackage = (name: string, packageJson: Record<string, unknown>) => {
    const packageDir = join(projectDir, 'node_modules', name);
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name, ...packageJson }));
  };

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'sb-telemetry-package-json-'));
    vi.spyOn(process, 'cwd').mockReturnValue(projectDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('resolves the version installed for the project in the current working directory', async () => {
    // this module's own dependency tree also contains react — the project's copy must win
    addPackage('react', { version: '0.0.0-project' });

    await expect(getActualPackageVersion('react')).resolves.toEqual({
      name: 'react',
      version: '0.0.0-project',
    });
  });

  it('resolves scoped packages', async () => {
    addPackage('@angular/core', { version: '14.3.0' });

    await expect(getActualPackageJson('@angular/core')).resolves.toMatchObject({
      name: '@angular/core',
      version: '14.3.0',
    });
  });

  it('resolves packages whose exports map does not expose package.json', async () => {
    addPackage('esm-only', {
      version: '1.2.3',
      exports: { '.': { import: './index.mjs' } },
    });

    await expect(getActualPackageJson('esm-only')).resolves.toMatchObject({
      name: 'esm-only',
      version: '1.2.3',
    });
  });

  it('returns a null version for packages that are not installed', async () => {
    await expect(getActualPackageVersion('not-installed')).resolves.toEqual({
      name: 'not-installed',
      version: null,
    });
  });
});
