import { setOutput } from '@actions/core';
import chalk from 'chalk';
import program from 'commander';
import ora from 'ora';
import invariant from 'tiny-invariant';

import { esMain } from '../utils/esmain';
import { git } from './utils/git-client';
import { getUnpickedPRs } from './utils/github-client';

program.name('pick-patches').description('Cherry pick patch PRs back to main');

const logger = console;

const OWNER = 'storybookjs';
const REPO = 'storybook';
const SOURCE_BRANCH = 'next';

interface PR {
  number: number;
  id: string;
  branch: string;
  title: string;
  mergeCommit: string;
}

function formatPR(pr: PR): string {
  return `https://github.com/${OWNER}/${REPO}/pull/${pr.number} "${pr.title}" ${chalk.yellow(
    pr.mergeCommit
  )}`;
}

export const run = async (_: unknown) => {
  if (!process.env.GH_TOKEN) {
    logger.error('GH_TOKEN environment variable must be set, exiting.');
    process.exit(1);
  }

  const sourceBranch = SOURCE_BRANCH;

  const spinner = ora('Searching for patch PRs to cherry-pick').start();

  const patchPRs = await getUnpickedPRs(sourceBranch);

  if (patchPRs.length > 0) {
    spinner.succeed(`Found ${patchPRs.length} PRs to cherry-pick to main.`);
  } else {
    spinner.warn('No PRs found.');
  }

  const failedCherryPicks: string[] = [];

  for (const pr of patchPRs) {
    const prSpinner = ora(`Cherry picking #${pr.number}`).start();

    try {
      await git.raw(['cherry-pick', '-m', '1', '--keep-redundant-commits', '-x', pr.mergeCommit]);
      prSpinner.succeed(`Picked: ${formatPR(pr)}`);
    } catch (pickError) {
      invariant(pickError instanceof Error);
      prSpinner.fail(`Failed to automatically pick: ${formatPR(pr)}`);
      logger.error(pickError.message);
      const abort = ora(`Aborting cherry pick for merge commit: ${pr.mergeCommit}`).start();
      try {
        await git.raw(['cherry-pick', '--abort']);
        abort.stop();
      } catch (abortError) {
        invariant(abortError instanceof Error);
        abort.warn(`Failed to abort cherry pick (${pr.mergeCommit})`);
        logger.error(abortError.message);
      }
      failedCherryPicks.push(pr.mergeCommit);
      prSpinner.info(
        `This PR can be picked manually with: ${chalk.grey(
          `git cherry-pick -m1 -x ${pr.mergeCommit}`
        )}`
      );
    }
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    setOutput('no-patch-prs', patchPRs.length === 0);
    setOutput('failed-cherry-picks', JSON.stringify(failedCherryPicks));
  }
};

if (esMain(import.meta.url)) {
  const options = program.parse(process.argv);
  run(options).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
