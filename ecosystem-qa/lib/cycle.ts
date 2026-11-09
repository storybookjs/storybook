import { closeSync, openSync, readSync } from 'node:fs';

import type { Engine, Os } from './schema.ts';

const SEMVER = /^(\d+)\.(\d+)\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SHA = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/**
 * Return the `major.minor` line of a Storybook version.
 *
 * @throws When the version is not a plain semver string.
 */
export const versionLine = (version: string): string => {
  const match = SEMVER.exec(version);
  if (!match) {
    throw new Error(`"${version}" is not a Storybook version.`);
  }
  return `${match[1]}.${match[2]}`;
};

// The full version keeps each prerelease on its own branch: a later prerelease starts from a fresh
// clone, so its head never descends from the previous one and could not fast-forward.
export const cycleBranchName = (version: string, os: Os, engine: Engine): string =>
  `qa/sb-${version}/${os}-${engine}`;

export interface BundleHeader {
  prerequisites: string[];
  refs: Map<string, string>;
}

export const parseBundleHeader = (text: string): BundleHeader => {
  const [signature, ...lines] = text.slice(0, text.indexOf('\n\n')).split('\n');
  if (!/^# v[23] git bundle$/.test(signature ?? '')) {
    throw new Error('Not a git bundle.');
  }
  const header: BundleHeader = { prerequisites: [], refs: new Map() };
  for (const line of lines) {
    if (line.startsWith('@')) {
      continue;
    }
    const prerequisite = line.startsWith('-');
    const [sha = '', ref] = (prerequisite ? line.slice(1) : line).split(' ');
    if (!SHA.test(sha)) {
      throw new Error(`Bad git bundle header line "${line}".`);
    }
    if (prerequisite) {
      header.prerequisites.push(sha);
    } else if (ref) {
      header.refs.set(ref, sha);
    }
  }
  return header;
};

export const readBundleHeader = (file: string): BundleHeader => {
  const buffer = Buffer.alloc(64 * 1024);
  const fd = openSync(file, 'r');
  try {
    const length = readSync(fd, buffer, 0, buffer.length, 0);
    return parseBundleHeader(buffer.subarray(0, length).toString('latin1'));
  } finally {
    closeSync(fd);
  }
};
