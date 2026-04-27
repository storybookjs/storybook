import * as core from '@actions/core';
import * as github from '@actions/github';

/**
 * agent scan classification rename
 * - organic -> human
 * - automated
 * - mixed
 */
const CLASSIFICATION_MAP = {
  organic: 'human',
  automation: 'automated',
};

async function main() {
  const classification = core.getInput('classification', { required: true });
  const token = core.getInput('token', { required: true });
  const isCommunityFlagged = core.getInput('community-flagged') === 'true';

  const octokit = github.getOctokit(token);
  const prNumber = github.context.payload.pull_request.number;

  await octokit.rest.issues.addLabels({
    ...github.context.repo,
    issue_number: prNumber,
    labels: [`agent-scan:${CLASSIFICATION_MAP[classification] ?? classification}`],
  });

  if (isCommunityFlagged) {
    await octokit.rest.issues.addLabels({
      ...github.context.repo,
      issue_number: prNumber,
      labels: ['agent-scan:community-flagged'],
    });
  }
}

main().catch((error) => {
  core.setFailed(error.message);
});
