import { dirname } from 'pathe';
import { z } from 'zod';

import { FRAMEWORKS, type CatalogEntry, type Feature } from './schema.ts';

const LOCKFILES: Record<string, CatalogEntry['packageManager']> = {
  'package-lock.json': 'npm',
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'bun.lock': 'bun',
  'bun.lockb': 'bun',
};

// The package manager of the lockfile at the root, or null when the root has none or several.
export const packageManagerOf = (paths: string[]): CatalogEntry['packageManager'] | null => {
  const managers = new Set(paths.flatMap((path) => LOCKFILES[path] ?? []));
  return managers.size === 1 ? [...managers][0]! : null;
};

const MAIN_CONFIG = /(?:^|\/)([^/]*storybook[^/]*)\/main\.[cm]?[jt]sx?$/;

// A Storybook directory is where its scripts run: the nearest directory with a package.json that
// holds a main config in a directory named like `.storybook`, or that directory itself.
export const storybookDirsOf = (paths: string[]): { dir: string; main: string }[] => {
  const packages = new Set(
    paths.filter((path) => /(?:^|\/)package\.json$/.test(path)).map((path) => dirname(path))
  );
  return paths
    .filter((path) => !path.split('/').includes('node_modules') && MAIN_CONFIG.test(path))
    .map((main) => {
      let dir = dirname(main);
      while (dir !== '.' && !packages.has(dir)) {
        dir = dirname(dir);
      }
      return { dir, main };
    });
};

const FEATURE_PACKAGES: Record<string, Feature> = {
  '@storybook/addon-vitest': 'vitest',
  '@storybook/experimental-addon-test': 'vitest',
  '@storybook/addon-docs': 'docs',
  '@storybook/addon-essentials': 'docs',
  '@storybook/addon-a11y': 'a11y',
  '@storybook/test-runner': 'test-runner',
  'msw-storybook-addon': 'msw',
};

export const PackageJson = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});
export type PackageJson = z.infer<typeof PackageJson>;

// The catalogs of a pnpm-workspace.yaml by name, the top-level `catalog:` as `default`. Each entry
// is one `name: range` line, which is all a catalog holds.
export const pnpmCatalogs = (yaml: string): Record<string, Record<string, string>> => {
  const catalogs: Record<string, Record<string, string>> = {};
  let section: 'catalog' | 'catalogs' | undefined;
  let current: Record<string, string> | undefined;
  for (const line of yaml.split('\n')) {
    if (/^\S/.test(line)) {
      section = /^catalog:\s*$/.test(line)
        ? 'catalog'
        : /^catalogs:\s*$/.test(line)
          ? 'catalogs'
          : undefined;
      current = section === 'catalog' ? (catalogs.default = {}) : undefined;
      continue;
    }
    const named = section === 'catalogs' ? /^ {2}(['"]?)([^'":\s]+)\1:\s*$/.exec(line) : null;
    if (named) {
      current = catalogs[named[2]!] = {};
      continue;
    }
    const entry = /^\s+(['"]?)([^'":\s]+)\1:\s*(['"]?)([^'"\s#]+)\3/.exec(line);
    if (current && entry) {
      current[entry[2]!] = entry[4]!;
    }
  }
  return catalogs;
};

const resolve = (range: string, name: string, catalogs: Record<string, Record<string, string>>) => {
  const catalog = /^catalog:(.*)$/.exec(range)?.[1];
  return catalog === undefined ? range : (catalogs[catalog || 'default']?.[name] ?? range);
};

// What a Storybook directory's package.json says about it. A monorepo often declares Storybook in
// the root package.json only, so the root fills in what the directory leaves out. A main config,
// when given, names the framework where the dependencies hold several.
export const storybookFacts = (
  own: PackageJson,
  root: PackageJson,
  { catalogs = {}, main }: { catalogs?: Record<string, Record<string, string>>; main?: string } = {}
) => {
  const deps = {
    ...root.dependencies,
    ...root.devDependencies,
    ...own.dependencies,
    ...own.devDependencies,
  };
  const installed = FRAMEWORKS.filter((name) => name in deps);
  const named = installed.filter(
    (name) => main?.includes(`'${name}'`) || main?.includes(`"${name}"`)
  );
  const frameworks = named.length > 0 ? named : installed;
  // A project that declares only its framework package gets Storybook through it, at its version.
  const source = deps.storybook === undefined ? frameworks[0] : 'storybook';
  const declared = source && deps[source];
  const range = source && declared ? resolve(declared, source, catalogs) : null;
  const major = /^[\^~>=v]*(\d+)\./.exec(range ?? '')?.[1];
  return {
    storybook: range,
    major: major === undefined ? null : Number(major),
    frameworks,
    features: [...new Set(Object.keys(deps).flatMap((name) => FEATURE_PACKAGES[name] ?? []))],
  };
};
