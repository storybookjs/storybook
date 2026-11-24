/**
 * Resolves the manager entries Storybook would bundle for a config directory, and writes them to
 * `entries.json` together with the package each entry belongs to.
 *
 * Run from `code/`: `STORYBOOK_MANAGER_BENCH_ADDONS=1 node core/scripts/manager-bundler-bench/collect.ts`
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { experimental_loadStorybook } from 'storybook/internal/core-server';

import {
  popularAddons,
  recentAddons,
  unregisteredAddons,
} from '../../../.storybook/bench-addons.ts';

const configDir = resolve(process.argv[2] ?? '.storybook');
const outFile = resolve(import.meta.dirname, 'entries.json');

const options = await experimental_loadStorybook({ configDir, packageJson: {} });
const [fromPresets, envs] = await Promise.all([
  options.presets.apply<string[]>('managerEntries', []),
  options.presets.apply<Record<string, string>>('env'),
]);

const configDirEntry = ['tsx', 'ts', 'jsx', 'js', 'mjs', 'mts']
  .map((ext) => join(configDir, `manager.${ext}`))
  .find((file) => existsSync(file));

const repoRoot = resolve(import.meta.dirname, '../../../..');

const findPackage = (file: string) => {
  let dir = dirname(file);
  while (dir !== dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      const { name, version } = JSON.parse(readFileSync(manifest, 'utf8'));
      if (name) {
        return { name, version, dir };
      }
    }
    dir = dirname(dir);
  }
  return { name: 'unknown', version: '0.0.0', dir: dirname(file) };
};

const requested = (list: string[], name: string) =>
  list.some((addon) => addon === name || addon.startsWith(`${name}/`));

const entries = [...fromPresets, ...(configDirEntry ? [configDirEntry] : [])].map((file) => {
  const pkg = findPackage(file);
  const group =
    file === configDirEntry
      ? 'config'
      : requested(popularAddons, pkg.name)
        ? 'popular'
        : requested(recentAddons, pkg.name)
          ? 'recent'
          : pkg.dir.includes('node_modules')
            ? 'external-preinstalled'
            : 'internal';
  return { file, package: pkg.name, version: pkg.version, group };
});

// Label entries by package, disambiguating packages that contribute several entries
const perPackage = new Map<string, number>();
for (const entry of entries) {
  perPackage.set(entry.package, (perPackage.get(entry.package) ?? 0) + 1);
}
const labelled = entries.map((entry) => ({
  ...entry,
  label:
    entry.group === 'config'
      ? '.storybook/manager'
      : (perPackage.get(entry.package) ?? 0) > 1
        ? `${entry.package} (${entry.file.split('/').slice(-2).join('/')})`
        : entry.package,
}));

const withoutEntry = [...popularAddons, ...recentAddons, ...unregisteredAddons].filter(
  (addon) =>
    !labelled.some((entry) => addon === entry.package || addon.startsWith(`${entry.package}/`))
);

writeFileSync(
  outFile,
  JSON.stringify(
    { configDir, repoRoot, cacheKey: options.cacheKey, envs, entries: labelled, withoutEntry },
    null,
    2
  )
);

for (const entry of labelled) {
  process.stdout.write(`${entry.group.padEnd(22)} ${entry.label}@${entry.version}\n`);
}
process.stdout.write(
  `\nRequested addons without a manager entry: ${withoutEntry.join(', ') || 'none'}\n`
);
process.exit(0);
