import { readJson } from 'fs-extra';
import { join } from 'path';
import { execaCommand } from 'execa';
import { esMain } from './utils/esmain';
import { CODE_DIRECTORY } from './utils/constants';

type Branch = 'main' | 'next' | 'alpha' | 'next-release' | 'latest-release';
type Workflow = 'merged' | 'daily';

const getFooter = async (branch: Branch, workflow: Workflow, job: string) => {
  if (job === 'chromatic-sandboxes') {
    return `\n\nThis might not necessarily be a bug, it could be a visual diff that you have to review and approve. Please check it!`;
  }

  // The CI workflows can run on release branches and we should display the version number
  if (branch === 'next-release' || branch === 'latest-release') {
    const packageJson = await readJson(join(CODE_DIRECTORY, 'package.json'));

    // running in alpha branch we should just show the version which failed
    return `\n**Version: ${packageJson.version}**`;
  }

  const mergeCommits =
    workflow === 'merged'
      ? // show single merge for merged workflow
        `git log -1 --pretty=format:"\`%h\` %<(12)%ar %s [%an]"`
      : // show last 24h merges for daily workflow
        `git log --merges --since="24 hours ago" --pretty=format:"\`%h\` %<(12)%ar %s [%an]"`;

  const result = await execaCommand(mergeCommits, { shell: true, cleanup: true });
  const formattedResult = result.stdout
    // discord needs escaped line breaks
    .replace(/\n/g, '\\n')
    // make links out of pull request ids
    .replace(/Merge pull request #/g, 'https://github.com/storybookjs/storybook/pull/');

  return `\n\n**Relevant PRs:**\n${formattedResult}`;
};

// This command is run in Circle CI on failures, to get a rich message to report to Discord
// Usage: yarn get-report-message type workflow branch
async function run() {
  const [, , workflow = '', template = 'none'] = process.argv;

  if (!workflow) {
    throw new Error('[get-report-message] Missing workflow argument.');
  }

  const { CIRCLE_BRANCH: currentBranch = '', CIRCLE_JOB: currentJob = '' } = process.env;

  if (!currentBranch || !currentJob) {
    throw new Error(
      '[get-report-message] Missing CIRCLE_BRANCH or CIRCLE_JOB environment variables.'
    );
  }

  const title = `Oh no! The **${currentJob}** job has failed${
    template !== 'none' ? ` for **${template}**.` : '.'
  }`;
  const body = `\n\n**Branch**: \`${currentBranch}\`\n**Workflow:** ${workflow}`;
  const footer = await getFooter(currentBranch as Branch, workflow as Workflow, currentJob);

  console.log(`${title}${body}${footer}`.replace(/\n/g, '\\n'));
}

if (esMain(import.meta.url)) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
