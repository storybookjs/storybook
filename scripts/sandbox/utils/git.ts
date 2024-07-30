import invariant from 'tiny-invariant';

import { execaCommand } from 'execa';

import { logger } from '../publish';

import { version as storybookVersion } from '../../../code/package.json';

const getTheLastCommitHashThatUpdatedTheSandboxRepo = async (branch: string) => {
  const owner = 'storybookjs';
  const repo = 'sandboxes';

  try {
    const branchData = await (
      await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`)
    ).json();
    const latestCommitSha = branchData.commit.sha;
    const commitData = await (
      await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${latestCommitSha}`)
    ).json();
    const latestCommitMessage = commitData.commit.message;

    // The commit message will look like this: 7.0.5 - Thu Apr 13 2023 - 97dbc82537c3
    // the hash at the end relates to the monorepo commit that updated the sandboxes
    const lastCommitHash = latestCommitMessage.split('\n')[0].split(' - ')[2];
    if (!lastCommitHash) {
      throw new Error(
        `Could not find the last commit hash in the following commit message: "${latestCommitMessage}".\nDid someone manually push to the sandboxes repo?`
      );
    }
    return lastCommitHash;
  } catch (error) {
    invariant(error instanceof Error);
    if (!error.message.includes('Did someone manually push to the sandboxes repo')) {
      logger.error(
        `⚠️  Error getting latest commit message of ${owner}/${repo} on branch ${branch}: ${error.message}`
      );
    }

    throw error;
  }
};

/**
 * When committing the changes to the sandboxes repo, we want to include the PRs that were merged since the last commit that updated the sandboxes.
 * This might help us debug issues or changes that affected the sandboxes at some point in time.
 */
export async function commitAllToGit({ cwd, branch }: { cwd: string; branch: string }) {
  try {
    logger.log(`💪 Committing everything to the repository`);

    await execaCommand('git add .', { cwd, cleanup: true });

    const currentCommitHash = (await execaCommand('git rev-parse HEAD', { cleanup: true })).stdout
      .toString()
      .slice(0, 12);

    let gitCommitCommand;

    logger.log('🔍 Determining commit message');
    try {
      const previousCommitHash = await getTheLastCommitHashThatUpdatedTheSandboxRepo(branch);
      const mergeCommits = (
        await execaCommand(
          `git log ${previousCommitHash}..${currentCommitHash} --merges --pretty=%s`,
          { cleanup: true }
        )
      ).stdout
        .toString()
        .split('\n')
        .filter((s: string) => s.includes('pull request'));

      const prLinks = mergeCommits.map((mergeCommit) => {
        const prNumber = mergeCommit.match(/Merge pull request #(\d+)/)[1];
        const branchName = mergeCommit.match(/from (.+)/)[1].replace('storybookjs/', '');
        return `- https://github.com/storybookjs/storybook/pull/${prNumber} (${branchName})`;
      });

      const diffLink = `https://github.com/storybookjs/storybook/compare/${previousCommitHash}...${currentCommitHash}`;

      const commitTitle = `${storybookVersion} - ${new Date().toDateString()} - ${previousCommitHash}`;
      const commitBody = [
        `\nCheck the diff here: ${diffLink}`,
        '\nList of included PRs since previous version:',
        ...prLinks,
      ].join('\n');
      gitCommitCommand = `git commit -m "${commitTitle}" -m "${commitBody}"`;
    } catch (err) {
      invariant(err instanceof Error);
      logger.log(
        `⚠️  Falling back to a simpler commit message because of an error while trying to get the previous commit hash: ${err.message}`
      );
      gitCommitCommand = `git commit -m "${storybookVersion} - ${new Date().toDateString()} - ${currentCommitHash}"`;
    }

    await execaCommand(gitCommitCommand, {
      shell: true,
      cleanup: true,
      cwd,
    });
  } catch (e) {
    invariant(e instanceof Error);
    if (e.message.includes('nothing to commit')) {
      logger.log(
        `🤷 Git found no changes between previous versions so there is nothing to commit. Skipping publish!`
      );
    } else {
      logger.error(`🤯 Something went wrong while committing to git: ${e.message}`);
    }
  }
}
