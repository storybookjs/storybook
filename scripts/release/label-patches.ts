import { program } from 'commander';
// eslint-disable-next-line depend/ban-dependencies
import ora from 'ora';
import { v4 as uuidv4 } from 'uuid';

import { esMain } from '../utils/esmain.ts';
import { getLatestMergedPrsFromCommits } from '../utils/github/associated-prs.ts';
import { getGithubClient } from '../utils/github/client.ts';
import { getLabelIds } from '../utils/github/labels.ts';
import { getRepo } from './utils/get-changes.ts';
import { getLatestTag, git } from './utils/git-client.ts';
import { getUnpickedPRs, RELEASE_SCOPES } from './utils/get-unpicked-prs.ts';

program
  .name('label-patches')
  .description('Label all patches applied in current branch up to the latest release tag.')
  .option(
    '-A, --all',
    'Label all pull requests pending patches, iregardless if they are in the git log or not',
    false
  );

async function labelPR(id: string, labelId: string) {
  await getGithubClient(RELEASE_SCOPES).graphql(
    `
      mutation ($input: AddLabelsToLabelableInput!) {
        addLabelsToLabelable(input: $input) {
          clientMutationId
        }
      }
    `,
    { input: { labelIds: [labelId], labelableId: id, clientMutationId: uuidv4() } }
  );
}

async function getPullRequestsFromLog({ repo }: { repo: string }) {
  const spinner = ora('Looking for latest tag').start();
  const latestTag = await getLatestTag();
  spinner.succeed(`Found latest tag: ${latestTag}`);

  const spinner2 = ora(`Looking at cherry pick commits since ${latestTag}`).start();
  const commitsSinceLatest = await git.log({ from: latestTag });
  console.log(commitsSinceLatest);
  const cherryPicked = commitsSinceLatest.all.flatMap((it) => {
    const result = it.body.match(/\(cherry picked from commit (\b[0-9a-f]{7,40}\b)\)/);
    return result ? [result?.[1]] : [];
  });

  if (cherryPicked.length === 0) {
    spinner2.fail('No cherry pick commits found to label.');
    return [];
  }
  const commitsWithPrs = (
    await getLatestMergedPrsFromCommits({ repo, commits: cherryPicked })
  ).filter((it): it is typeof it & { pr: NonNullable<typeof it.pr> } => it.pr !== null);

  if (commitsWithPrs.length === 0) {
    spinner2.fail(
      `Found picks: ${cherryPicked.join(', ')}, but no associated pull request found to label.`
    );
    return commitsWithPrs;
  }

  const lines = commitsWithPrs.map(
    (it) => `Commit: ${it.commit}\n PR: [#${it.pr.number}](${it.pr.url})`
  );

  spinner2.succeed(`Found the following picks 🍒:\n ${lines.join('\n')}`);

  return commitsWithPrs;
}

export const run = async (options: unknown) => {
  if (!process.env.GH_TOKEN) {
    throw new Error('GH_TOKEN environment variable must be set, exiting.');
  }

  const repo = await getRepo();
  const labelAll = typeof options === 'object' && 'all' in options && Boolean(options.all);

  const idsToLabel: string[] = labelAll
    ? (await getUnpickedPRs('next')).map((p) => p.id)
    : (await getPullRequestsFromLog({ repo })).map((c) => c.pr.id);
  if (idsToLabel.length === 0) {
    return;
  }

  const spinner3 = ora(`Labeling ${idsToLabel.length} PRs with the patch:done label...`).start();
  try {
    const labelToId = await getLabelIds({ repo, labelNames: ['patch:done'] });
    await Promise.all(idsToLabel.map((id) => labelPR(id, labelToId['patch:done'])));
    spinner3.succeed(`Successfully labeled all PRs with the patch:done label.`);
  } catch (e) {
    spinner3.fail(`Something went wrong when labelling the PRs.`);
    console.error(e);
  }
};

if (esMain(import.meta.url)) {
  const options = program.parse().opts();
  run(options).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
