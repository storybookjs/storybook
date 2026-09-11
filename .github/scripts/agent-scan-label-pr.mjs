import * as core from '@actions/core';
import * as github from '@actions/github';

/**
 * agent scan classification name
 * - organic -> human
 */
const CLASSIFICATION_MAP = {
  organic: 'human',
};

async function main() {
  const classification = core.getInput('classification', { required: true });
  const token = core.getInput('token', { required: true });

  const octokit = github.getOctokit(token);
  const prNumber = github.context.payload.pull_request.number;

  if (classification === 'organic') {
    const labels = [`agent-scan:${CLASSIFICATION_MAP[classification] ?? classification}`];

    await octokit.rest.issues.addLabels({
      ...github.context.repo,
      issue_number: prNumber,
      labels: labels,
    });
  }
}

main().catch((error) => {
  core.setFailed(error.message);
});
