import * as core from '@actions/core';
import * as github from '@actions/github';

async function main() {
  const token = core.getInput('token', { required: true });

  const octokit = github.getOctokit(token);
  const prNumber = github.context.payload.pull_request.number;

  await octokit.rest.pulls.update({
    ...github.context.repo,
    pull_number: prNumber,
    state: 'closed',
  });
}

main().catch((error) => {
  core.setFailed(error.message);
});
