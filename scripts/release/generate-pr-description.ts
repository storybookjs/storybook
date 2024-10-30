import { setOutput } from '@actions/core';
import { program } from 'commander';
import picocolors from 'picocolors';
import semver from 'semver';
import { dedent } from 'ts-dedent';
import { z } from 'zod';

import { esMain } from '../utils/esmain';
import { getCurrentVersion } from './get-current-version';
import type { Change } from './utils/get-changes';
import { LABELS_BY_IMPORTANCE, RELEASED_LABELS, getChanges } from './utils/get-changes';
import type { PullRequestInfo } from './utils/get-github-info';

program
  .name('generate-pr-description')
  .description('generate a PR description for a release')
  .option(
    '-C, --current-version <version>',
    'Which version to generate changelog from, eg. "7.0.7". Defaults to the version at code/package.json'
  )
  .option('-N, --next-version <version>', 'Which version to generate changelog to, eg. "7.0.8"')
  .option('-P, --unpicked-patches', 'Set to only consider PRs labeled with "patch:yes" label')
  .option(
    '-M, --manual-cherry-picks <commits>',
    'A stringified JSON array of commit hashes, of patch PRs that needs to be cherry-picked manually'
  )
  .option('-V, --verbose', 'Enable verbose logging', false);

const optionsSchema = z.object({
  currentVersion: z.string().optional(),
  nextVersion: z.string().optional(),
  unpickedPatches: z.boolean().optional(),
  manualCherryPicks: z
    .string()
    .default('[]')
    .transform((val) => JSON.parse(val))
    .refine((val) => Array.isArray(val)),
  verbose: z.boolean().optional(),
});

type Options = {
  currentVersion?: string;
  nextVersion?: string;
  unpickedPatches?: boolean;
  manualCherryPicks?: string[];
  verbose: boolean;
};

const CHANGE_TITLES_TO_IGNORE = [
  /^bump version.*/i,
  /^merge branch.*/i,
  /\[skip ci\]/i,
  /\[ci skip\]/i,
  /^Update CHANGELOG\.md for.*/i,
  /^Release: (Pre)?(Patch|Minor|Major|Release).*\d+$/i,
  /^Update \.\/docs\/versions/,
];

export const mapToChangelist = ({
  changes,
  unpickedPatches,
}: {
  changes: Change[];
  unpickedPatches: boolean;
}): string => {
  return changes
    .filter((change) => {
      for (const titleToIgnore of CHANGE_TITLES_TO_IGNORE) {
        if (change.title?.match(titleToIgnore)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const isReleasable = (pr: PullRequestInfo) =>
        (pr.labels ?? []).some((label) => Object.keys(RELEASED_LABELS).includes(label));
      return Number(isReleasable(b)) - Number(isReleasable(a));
    })
    .map((change) => {
      if (!change.pull) {
        return `- [ ] **⚠️ Direct commit**: ${change.title} ${change.links.commit}`;
      }

      const label = (change.labels
        ?.filter((l) => Object.keys(LABELS_BY_IMPORTANCE).includes(l))
        .sort(
          (a, b) =>
            Object.keys(LABELS_BY_IMPORTANCE).indexOf(a) -
            Object.keys(LABELS_BY_IMPORTANCE).indexOf(b)
        )[0] || 'unknown') as keyof typeof LABELS_BY_IMPORTANCE;

      return `- [ ] **${LABELS_BY_IMPORTANCE[label]}**: ${change.title} ${change.links.pull}${
        !unpickedPatches && change.labels?.includes('patch:yes') ? ' (will also be patched)' : ''
      }`;
    })
    .join('\n');
};

export const mapCherryPicksToTodo = ({
  commits,
  changes,
  verbose,
}: {
  commits: string[];
  changes: Change[];
  verbose?: boolean;
}): string => {
  const list = commits
    .map((commit) => {
      const foundChange = changes.find((change) => change.commit === commit);
      if (!foundChange) {
        throw new Error(
          `Cherry pick commit "${commit}" not found in changes, this should not happen?!`
        );
      }
      return `- [ ] ${foundChange.links.pull}: \`git cherry-pick -m1 -x ${commit}\``;
    })
    .join('\n');

  if (verbose) {
    console.log(`🍒 Cherry pick list:\n${list}`);
  }
  return dedent`## 🍒 Manual cherry picking needed!

  The following pull requests could not be cherry-picked automatically because it resulted in merge conflicts.
  For each pull request below, you need to either manually cherry pick it, or discard it by replacing the "patch:yes" label with "patch:no" on the PR and re-generate this PR.
  
  ${list}`;
};

export const generateReleaseDescription = ({
  currentVersion,
  nextVersion,
  changeList,
  changelogText,
  manualCherryPicks,
}: {
  currentVersion: string;
  nextVersion: string;
  changeList: string;
  changelogText: string;
  manualCherryPicks?: string;
}): string => {
  const workflow = semver.prerelease(nextVersion)
    ? 'prepare-non-patch-release'
    : 'prepare-patch-release';
  const workflowUrl = `https://github.com/storybookjs/storybook/actions/workflows/${workflow}.yml`;

  return (
    dedent`This is an automated pull request that bumps the version from \`${currentVersion}\` to \`${nextVersion}\`.
  Once this pull request is merged, it will trigger a new release of version \`${nextVersion}\`.
  If you're not a core maintainer with permissions to release you can ignore this pull request.

  ## To do

  Before merging the PR, there are a few QA steps to go through:

  - [ ] Add the "freeze" label to this PR, to ensure it doesn't get automatically forced pushed by new changes.
  - [ ] Add the "ci:daily" label to this PR, to trigger the full test suite to run on this PR.
  
  And for each change below:
  
  1. Ensure the change is appropriate for the version bump. E.g. patch release should only contain patches, not new or de-stabilizing features. If a change is not appropriate, revert the PR.
  2. Ensure the PR is labeled correctly with one of: ${Object.keys(LABELS_BY_IMPORTANCE)
    .map((label) => `"${label}"`)
    .join(', ')}.
  3. Ensure the PR title is correct, and follows the format "[Area]: [Summary]", e.g. *"React: Fix hooks in CSF3 render functions"*. If it is not correct, change the title in the PR.
      - Areas include: React, Vue, Core, Docs, Controls, etc.
      - First word of summary indicates the type: “Add”, “Fix”, “Upgrade”, etc.
      - The entire title should fit on a line
  
  This is a list of all the PRs merged and commits pushed directly to \`next\`, that will be part of this release:
  
  ${changeList}

  ${manualCherryPicks || ''}

  If you've made any changes doing the above QA (change PR titles, revert PRs), manually trigger a re-generation of this PR with [this workflow](${workflowUrl}) and wait for it to finish. It will wipe your progress in this to do, which is expected.

  Feel free to manually commit any changes necessary to this branch **after** you've done the last re-generation, following the [Make Manual Changes](https://github.com/storybookjs/storybook/blob/next/CONTRIBUTING/RELEASING.md#5-make-manual-changes) section in the docs, *especially* if you're making changes to the changelog.

  When everything above is done:
  - Merge this PR
  - [Follow the run of the publish action](https://github.com/storybookjs/storybook/actions/workflows/publish.yml)
  
  ---
  
  # Generated changelog
  
  ${changelogText}`
      // don't mention contributors in the release PR, to avoid spamming them
      .replaceAll('[@', '[@ ')
      .replaceAll('"', '\\"')
      .replaceAll('`', '\\`')
      .replaceAll("'", "\\'")
  );
};

export const generateNonReleaseDescription = (
  changeList: string,
  manualCherryPicks?: string
): string => {
  return (
    dedent`This is an automated pull request. None of the changes requires a version bump, they are only internal or documentation related. Merging this PR will not trigger a new release, but documentation will be updated.
  If you're not a core maintainer with permissions to release you can ignore this pull request.
  
  ## To do

  Before merging the PR:

  - [ ] Add the "freeze" label to this PR, to ensure it doesn't get automatically forced pushed by new changes.
  - [ ] Add the "ci:daily" label to this PR, to trigger the full test suite to run on this PR.

  This is a list of all the PRs merged and commits pushed directly to \`next\` since the last release:
  
  ${changeList}

  ${manualCherryPicks || ''}

  If you've made any changes (change PR titles, revert PRs), manually trigger a re-generation of this PR with [this workflow](https://github.com/storybookjs/storybook/actions/workflows/prepare-patch-release.yml) and wait for it to finish.
  
  Feel free to manually commit any changes necessary to this branch **after** you've done the last re-generation, following the [Make Manual Changes](https://github.com/storybookjs/storybook/blob/next/CONTRIBUTING/RELEASING.md#5-make-manual-changes) section in the docs.

  When everything above is done:
  - Merge this PR
  - [Follow the run of the publish action](https://github.com/storybookjs/storybook/actions/workflows/publish.yml)`
      // don't mention contributors in the release PR, to avoid spamming them
      .replaceAll('@', '')
      .replaceAll('"', '\\"')
      .replaceAll('`', '\\`')
      .replaceAll("'", "\\'")
  );
};

export const run = async (rawOptions: unknown) => {
  const { nextVersion, unpickedPatches, verbose, manualCherryPicks, ...options } =
    optionsSchema.parse(rawOptions) as Options;

  if (!nextVersion) {
    console.log(
      '🚨 --next-version option not specified, generating PR description assuming no release is needed'
    );
  }

  const currentVersion = options.currentVersion || (await getCurrentVersion());

  console.log(
    `💬 Generating PR description for ${picocolors.blue(nextVersion)} between ${picocolors.green(
      currentVersion
    )} and ${picocolors.green('HEAD')}`
  );

  const { changes, changelogText } = await getChanges({
    version: nextVersion,
    from: `v${currentVersion}`,
    to: 'HEAD',
    unpickedPatches,
    verbose,
  });

  const hasCherryPicks = manualCherryPicks?.length > 0;

  const description = nextVersion
    ? generateReleaseDescription({
        currentVersion,
        nextVersion,
        changeList: mapToChangelist({ changes, unpickedPatches }),
        changelogText,
        ...(hasCherryPicks && {
          manualCherryPicks: mapCherryPicksToTodo({
            commits: manualCherryPicks,
            changes,
            verbose,
          }),
        }),
      })
    : generateNonReleaseDescription(
        mapToChangelist({ changes, unpickedPatches }),
        hasCherryPicks
          ? mapCherryPicksToTodo({
              commits: manualCherryPicks,
              changes,
              verbose,
            })
          : undefined
      );

  if (process.env.GITHUB_ACTIONS === 'true') {
    setOutput('description', description);
  }
  console.log(`✅ Generated PR description for ${picocolors.blue(nextVersion)}`);
  if (verbose) {
    console.log(description);
  }
};

if (esMain(import.meta.url)) {
  const parsed = program.parse();
  run(parsed.opts()).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
