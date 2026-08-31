import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORYBOOK_MANIFEST = 'storybook/package.json';

export type CwdOrBin = { kind: 'directory'; path: string } | { kind: 'file'; path: string };

export function inspectCwdOrBin(path: string): CwdOrBin {
  const resolved = resolve(path);
  try {
    if (statSync(resolved).isFile()) {
      return { kind: 'file', path: resolved };
    }
  } catch {
    // A path that does not exist is treated as a project directory so config dirs still resolve.
  }
  return { kind: 'directory', path: resolved };
}

export function createRequireFromCwdOrBin(path: string): NodeJS.Require {
  const inspected = inspectCwdOrBin(path);
  return inspected.kind === 'file'
    ? createRequire(inspected.path)
    : createRequire(join(inspected.path, 'package.json'));
}

export function requireSearchPath(path: string): string {
  const inspected = inspectCwdOrBin(path);
  return inspected.kind === 'file' ? dirname(inspected.path) : inspected.path;
}

export function resolveStorybookPackageJson(path: string): string | undefined {
  try {
    return createRequireFromCwdOrBin(path).resolve(STORYBOOK_MANIFEST, {
      paths: [requireSearchPath(path)],
    });
  } catch {
    return undefined;
  }
}

export function workingDirectoryForCwdOrBin(path: string, configDir?: string): string {
  const inspected = inspectCwdOrBin(path);
  if (inspected.kind === 'directory') {
    return inspected.path;
  }
  if (configDir) {
    return dirname(resolve(configDir));
  }
  return process.cwd();
}

export function resolveRecordedCwd({
  processCwd = process.cwd(),
  invokedPath = process.argv[1],
  fallbackFile = fileURLToPath(import.meta.url),
}: {
  processCwd?: string;
  invokedPath?: string;
  fallbackFile?: string;
} = {}): string {
  if (resolveStorybookPackageJson(processCwd)) {
    return resolve(processCwd);
  }
  for (const candidate of [invokedPath, fallbackFile]) {
    if (!candidate) {
      continue;
    }
    const inspected = inspectCwdOrBin(candidate);
    if (inspected.kind === 'file' && resolveStorybookPackageJson(inspected.path)) {
      return inspected.path;
    }
  }
  return resolve(processCwd);
}
