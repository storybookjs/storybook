import picocolors from 'picocolors';
import semver from 'semver';

import {
  getLatestMergedPrsFromCommits,
  type CommitWithPr,
} from '../../utils/github/associated-prs.ts';
import { getLatestTag, git } from './git-client.ts';
import { getUnpickedPRs } from './get-unpicked-prs.ts';

export const RELEASED_LABELS = {
  'BREAKING CHANGE': '❗ Breaking Change',
  'feature request': '✨ Feature Request',
  bug: '🐛 Bug',
  maintenance: '🔧 Maintenance',
  dependencies: '📦 Dependencies',
} as const;

export const UNRELEASED_LABELS = {
  documentation: '📝 Documentation',
  build: '🏗️ Build',
  unknown: '❔ Missing Label',
} as const;

export const LABELS_BY_IMPORTANCE = {
  ...RELEASED_LABELS,
  ...UNRELEASED_LABELS,
} as const;

/**
 * Lean changelog entry. Built from `CommitWithPr` (the github-side shape) +
 * a fallback commit message. Renderers compute the markdown link strings
 * from the raw URLs and identifiers — keeps the type small and avoids the
 * legacy "stringly-typed" `.links.{commit,pull,user}` markdown bag.
 */
export interface Change {
  commit: string;
  commitUrl: string | null;
  prId: string | null;
  prNumber: number | null;
  prUrl: string | null;
  user: string | null;
  userUrl: string | null;
  title: string;
  labels: string[];
}

/** `[#42](https://…)` markdown for the PR ref. */
export const prMarkdown = (change: Change): string | null =>
  change.prNumber !== null && change.prUrl
    ? `[#${change.prNumber}](${change.prUrl})`
    : null;

/** `` [`abc1234`](https://…) `` markdown for the commit ref (with link when available). */
export const commitMarkdown = (change: Change): string =>
  change.commitUrl
    ? `[\`${change.commit}\`](${change.commitUrl})`
    : `\`${change.commit}\``;

const getCommitAt = async (id: string, verbose?: boolean) => {
  if (!semver.valid(id)) {
    console.log(
      `🔍 ${picocolors.red(id)} is not a valid semver string, assuming it is a commit hash`
    );
    return id;
  }
  const version = id.startsWith('v') ? id : `v${id}`;
  const commitSha = (await git.raw(['rev-list', '-n', '1', version])).split('\n')[0];
  if (verbose) {
    console.log(`🔍 Commit at tag ${picocolors.green(version)}: ${picocolors.blue(commitSha)}`);
  }
  return commitSha;
};

export const getFromCommit = async (from?: string | undefined, verbose?: boolean) => {
  let actualFrom = from;
  if (!from) {
    console.log(`🔍 No 'from' specified, finding latest version tag, fetching all of them...`);
    const latest = await getLatestTag();
    if (!latest) {
      throw new Error(
        'Could not automatically detect which commit to generate from, because no version tag was found in the history. Have you fetch tags?'
      );
    }
    actualFrom = latest;
    if (verbose) {
      console.log(`🔍 No 'from' specified, found latest tag: ${picocolors.blue(latest)}`);
    }
  }
  const commit = await getCommitAt(actualFrom!, verbose);
  if (verbose) {
    console.log(`🔍 Found 'from' commit: ${picocolors.blue(commit)}`);
  }
  return commit;
};

export const getToCommit = async (to?: string | undefined, verbose?: boolean) => {
  if (!to) {
    const head = await git.revparse('HEAD');
    if (verbose) {
      console.log(`🔍 No 'to' specified, HEAD is at commit: ${picocolors.blue(head)}`);
    }
    return head;
  }

  const commit = await getCommitAt(to, verbose);
  if (verbose) {
    console.log(`🔍 Found 'to' commit: ${picocolors.blue(commit)}`);
  }
  return commit;
};

export const getAllCommitsBetween = async ({
  from,
  to,
  verbose,
}: {
  from: string;
  to?: string;
  verbose?: boolean;
}) => {
  const logResult = await git.log({ from, to, '--first-parent': null });
  if (verbose) {
    console.log(
      `🔍 Found ${picocolors.blue(logResult.total)} commits between ${picocolors.green(
        `${from}`
      )} and ${picocolors.green(`${to}`)}:`
    );
    console.dir(logResult.all, { depth: null, colors: true });
  }
  return logResult.all;
};

export const getRepo = async (verbose?: boolean): Promise<string> => {
  const remotes = await git.getRemotes(true);
  const originRemote = remotes.find((remote) => remote.name === 'origin');
  if (!originRemote) {
    console.error(
      'Could not determine repository URL because no remote named "origin" was found. Remotes found:'
    );
    console.dir(remotes, { depth: null, colors: true });
    throw new Error('No remote named "origin" found');
  }
  const pushUrl = originRemote.refs.push;
  const repo = pushUrl.replace(/\.git$/, '').replace(/.*:(\/\/github\.com\/)*/, '');
  if (verbose) {
    console.log(`📦 Extracted repo: ${picocolors.blue(repo)}`);
  }
  return repo;
};

/** Compose a `Change` from a github-side `CommitWithPr` + the original commit object. */
function toChange(it: CommitWithPr, message: string | undefined): Change {
  const user = it.pr?.author ?? it.commitAuthor;
  return {
    commit: it.commit,
    commitUrl: it.commitUrl,
    prId: it.pr?.id ?? null,
    prNumber: it.pr?.number ?? null,
    prUrl: it.pr?.url ?? null,
    user: user?.login ?? null,
    userUrl: user?.url ?? null,
    title: it.pr?.title || message || '',
    labels: it.pr?.labels ?? [],
  };
}

export const mapToChanges = ({
  commits,
  commitsWithPrs,
  unpickedPatches,
  verbose,
}: {
  commits: readonly { hash: string; message?: string }[];
  commitsWithPrs: readonly CommitWithPr[];
  unpickedPatches?: boolean;
  verbose?: boolean;
}): Change[] => {
  if (commitsWithPrs.length !== commits.length) {
    console.error(
      'commitsWithPrs and commits are not the same length, this should not happen'
    );
    console.error(`commitsWithPrs: ${commitsWithPrs.length}`);
    console.dir(commitsWithPrs, { depth: null, colors: true });
    console.error(`Commits: ${commits.length}`);
    console.dir(commits, { depth: null, colors: true });
    throw new Error(
      'commitsWithPrs and commits are not the same length, this should not happen'
    );
  }
  const allEntries = commitsWithPrs.map((it, index) => toChange(it, commits[index].message));

  const changes: Change[] = [];
  for (const entry of allEntries) {
    // Skip duplicate PRs (one PR, multiple commits).
    if (entry.prNumber !== null && changes.some((c) => c.prNumber === entry.prNumber)) {
      continue;
    }
    // Patches mode also drops direct commits and non-patch-labelled PRs.
    if (unpickedPatches && !entry.labels.includes('patch:yes')) {
      continue;
    }
    changes.push(entry);
  }

  if (verbose) {
    console.log(`📝 Generated changelog entries:`);
    console.dir(changes, { depth: null, colors: true });
  }
  return changes;
};

export const getChangelogText = ({
  changes,
  version,
}: {
  changes: Change[];
  version: string;
}): string => {
  const heading = `## ${version}`;
  const formattedEntries = changes
    .filter((entry) => entry.prNumber !== null)
    .filter((entry) => entry.labels.some((label) => Object.keys(RELEASED_LABELS).includes(label)))
    .map((entry) => {
      const userPart = entry.user ? `, thanks @${entry.user}!` : '';
      return `- ${entry.title} - ${prMarkdown(entry)}${userPart}`;
    })
    .sort();
  const text = [heading, '', ...formattedEntries].join('\n');

  console.log(`✅ Generated Changelog:`);
  console.log(text);

  return text;
};

export const getChanges = async ({
  version,
  from,
  to,
  unpickedPatches,
  verbose,
}: {
  version: string;
  from?: string;
  to?: string;
  unpickedPatches?: boolean;
  verbose?: boolean;
}) => {
  console.log(`💬 Getting changes for ${picocolors.blue(version)}`);

  let commits;
  if (unpickedPatches) {
    commits = (await getUnpickedPRs('next', verbose)).map((it) => ({ hash: it.mergeCommit }));
  } else {
    commits = await getAllCommitsBetween({
      from: await getFromCommit(from, verbose),
      to: await getToCommit(to, verbose),
      verbose,
    });
  }

  const repo = await getRepo(verbose);
  const commitsWithPrs = await getLatestMergedPrsFromCommits({
    repo,
    commits: commits.map((c) => c.hash),
  }).catch((err) => {
    console.error(
      `🚨 Could not get pull requests from commits, this is usually because you have unpushed commits, or you haven't set the GH_TOKEN environment variable`
    );
    console.error(err);
    throw err;
  });
  if (verbose) {
    console.log(`🔍 Found pull requests:`);
    console.dir(commitsWithPrs, { depth: null, colors: true });
  }

  const changes = mapToChanges({ commits, commitsWithPrs, unpickedPatches, verbose });
  const changelogText = getChangelogText({ changes, version });

  return { changes, changelogText };
};
