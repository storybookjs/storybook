import { existsSync, globSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');

// The setup job generates the config before anything is installed, so these files are read
// without a YAML parser.
const readRootFile = (file: string) =>
  readFileSync(join(ROOT, file), 'utf8').replaceAll('\r\n', '\n');

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The pnpm version that the root `packageManager` field pins, e.g. `10.34.9`. */
export function getPnpmVersion(): string {
  const { packageManager } = JSON.parse(readRootFile('package.json'));
  const version = /^pnpm@([^+]+)/.exec(packageManager ?? '')?.[1];
  if (!version) {
    throw new Error(`The root packageManager field pins no pnpm version: ${packageManager}`);
  }
  return version;
}

/** The directories of the workspace packages, relative to the repository root. */
export function getWorkspaceDirs(): string[] {
  const list = /^packages:\n((?: +- .+\n)+)/m.exec(readRootFile('pnpm-workspace.yaml'))?.[1];
  if (!list) {
    throw new Error('pnpm-workspace.yaml has no packages list');
  }
  const patterns = list
    .trimEnd()
    .split('\n')
    .map((line) => line.replace(/^ +- /, '').replace(/^(['"])(.*)\1$/, '$2'));
  if (patterns.some((pattern) => pattern.startsWith('!'))) {
    throw new Error('Negated pnpm-workspace.yaml package patterns are not supported here');
  }

  return patterns
    .flatMap((pattern) => globSync(pattern, { cwd: ROOT }))
    .filter((dir) => existsSync(join(ROOT, dir, 'package.json')))
    .map((dir) => dir.split(sep).join('/'))
    .sort();
}

/** The version of `name` that pnpm-lock.yaml locks for the workspace package at `importer`. */
export function getLockedVersion(importer: string, name: string): string {
  const block = readRootFile('pnpm-lock.yaml')
    .split(/^(?=\S)/m)
    .find((section) => section.startsWith('importers:'))
    ?.split(/^ {2}(?=\S)/m)
    .find((entry) => entry.startsWith(`${importer}:\n`));
  const version = block?.match(
    new RegExp(`^ {6}'?${escapeRegExp(name)}'?:\\n {8}specifier: .+\\n {8}version: ([^(\\s]+)`, 'm')
  )?.[1];
  if (!version) {
    throw new Error(`pnpm-lock.yaml locks no ${name} for the ${importer} importer`);
  }
  return version;
}
