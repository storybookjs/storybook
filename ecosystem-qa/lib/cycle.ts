import { closeSync, openSync, readSync } from 'node:fs';

import type { Engine, Os } from './schema.ts';

/** A fine-grained token belongs to one owner, so each org the filer may push to has its own secret. */
export const PUSH_TOKEN_ENV = {
  storybookjs: 'ECOSYSTEM_QA_PUSH_TOKEN',
  'storybook-tmp': 'ECOSYSTEM_QA_PUSH_TOKEN_STORYBOOK_TMP',
} as const;

/**
 * Return the name of the env var that holds the push token for the owner of an `owner/name` repo.
 *
 * @throws When the owner has no push token configured.
 */
export const pushTokenEnv = (repo: string): string => {
  const owner = repo.split('/')[0] ?? '';
  if (!Object.hasOwn(PUSH_TOKEN_ENV, owner)) {
    throw new Error(`No push token is configured for the owner of "${repo}".`);
  }
  return PUSH_TOKEN_ENV[owner as keyof typeof PUSH_TOKEN_ENV];
};

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

// Every sweep starts from a fresh clone, so two sweeps of one version, os and engine have unrelated
// heads and cannot share a remote branch. The head suffix gives each sweep its own branch and keeps
// it stable when the same proposals are filed again.
export const publishedCycleBranch = (cycleBranch: string, headSha: string): string =>
  `${cycleBranch}-${headSha.slice(0, 10)}`;

// The upgraded state is published under refs/qa/, not as a branch: a branch push starts the
// catalog repo's own workflows, which would run the agent's commits with that repo's secrets before
// anyone read the diff. A ref outside refs/heads and refs/tags triggers nothing, keeps the commits
// reachable, and becomes a branch with one push once a person has looked at it.
export const cycleRef = (published: string): string => `refs/qa/${published.replace(/^qa\//, '')}`;

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
