import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { getLockedVersion, getPnpmVersion, getWorkspaceDirs } from './workspace.ts';

const ROOT = join(import.meta.dirname, '../../..');

const lockfile = parse(readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8'));

describe('getWorkspaceDirs', () => {
  it('lists the workspace packages that pnpm-lock.yaml has importers for', () => {
    const importers = Object.keys(lockfile.importers).filter((importer) => importer !== '.');

    expect(getWorkspaceDirs()).toEqual(importers.sort());
  });
});

describe('getLockedVersion', () => {
  const { dependencies, devDependencies, optionalDependencies } = lockfile.importers.scripts;
  const locked = Object.entries<{ version: string }>({
    ...dependencies,
    ...devDependencies,
    ...optionalDependencies,
  });

  it.each(locked.map(([name, { version }]) => [name, version.replace(/\(.*$/, '')]))(
    'reads the scripts importer’s %s as %s',
    (name, version) => {
      expect(getLockedVersion('scripts', name)).toBe(version);
    }
  );

  it('throws for a package the importer does not depend on', () => {
    expect(() => getLockedVersion('scripts', 'left-pad')).toThrow('locks no left-pad');
  });
});

describe('getPnpmVersion', () => {
  it('reads the version the packageManager field pins', () => {
    const { packageManager } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

    expect(packageManager).toMatch(new RegExp(`^pnpm@${getPnpmVersion()}\\+sha512\\.`));
  });
});
