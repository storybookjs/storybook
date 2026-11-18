import * as core from '@actions/core';
import * as github from '@actions/github';

async function main() {
  const token = core.getInput('token', { required: true });
  const org = core.getInput('org', { required: true });
  const username = core.getInput('username', { required: true });

  const octokit = github.getOctokit(token);

  let isOrgMember = false;

  try {
    await octokit.rest.orgs.checkMembershipForUser({
      org,
      username,
    });

    isOrgMember = true;
  } catch (error) {
    if (error.status === 404) {
    } else if (error.status === 302 || error.status === 403) {
      core.warning(
        `Unable to verify org membership for ${username}; GitHub API returned ${error.status}. Falling back to scanning this fork PR.`
      );
    } else {
      throw error;
    }
  }

  core.setOutput('is-org-member', String(isOrgMember));
  core.setOutput('should-scan', String(!isOrgMember));
}

main().catch((error) => {
  core.setFailed(error.message);
});
