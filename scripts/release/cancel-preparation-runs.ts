/**
 * This script cancels all running preparation workflows in GitHub. It will fetch all active runs
 * for the preparation workflows, and cancel them.
 */
import { program } from 'commander';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { esMain } from '../utils/esmain';
import { githubRestClient } from './utils/github-client';

program
  .name('cancel-preparation-workflows')
  .description('cancel all running preparation workflows in GitHub');

export const PREPARE_PATCH_WORKFLOW_PATH = '.github/workflows/prepare-patch-release.yml';
export const PREPARE_NON_PATCH_WORKFLOW_PATH = '.github/workflows/prepare-non-patch-release.yml';

export const run = async () => {
  if (!process.env.GH_TOKEN) {
    throw new Error('GH_TOKEN environment variable must be set, exiting.');
  }

  console.log(`🔎 Looking for workflows to cancel...`);
  const allWorkflows = await githubRestClient('GET /repos/{owner}/{repo}/actions/workflows', {
    owner: 'storybookjs',
    repo: 'storybook',
  });

  const preparePatchWorkflowId = allWorkflows.data.workflows.find(
    ({ path }) => path === PREPARE_PATCH_WORKFLOW_PATH
  )?.id;
  const prepareNonPatchWorkflowId = allWorkflows.data.workflows.find(
    ({ path }) => path === PREPARE_NON_PATCH_WORKFLOW_PATH
  )?.id;

  console.log(`Found workflow IDs for the preparation workflows:
    ${picocolors.blue(PREPARE_PATCH_WORKFLOW_PATH)}: ${picocolors.green(preparePatchWorkflowId)}
    ${picocolors.blue(PREPARE_NON_PATCH_WORKFLOW_PATH)}: ${picocolors.green(prepareNonPatchWorkflowId)}`);

  if (!preparePatchWorkflowId || !prepareNonPatchWorkflowId) {
    throw new Error(dedent`🚨 Could not find workflow IDs for the preparation workflows
    - Looked for paths: "${picocolors.blue(PREPARE_PATCH_WORKFLOW_PATH)}" and "${picocolors.blue(
      PREPARE_NON_PATCH_WORKFLOW_PATH
    )}", are they still correct?
    - Found workflows:
      ${JSON.stringify(allWorkflows.data.workflows, null, 2)}`);
  }

  console.log('🔍 Fetching patch and non-patch runs for preparation workflows...');
  const [patchRuns, nonPatchRuns] = await Promise.all([
    githubRestClient('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
      owner: 'storybookjs',
      repo: 'storybook',
      workflow_id: preparePatchWorkflowId,
    }),
    githubRestClient('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
      owner: 'storybookjs',
      repo: 'storybook',
      workflow_id: prepareNonPatchWorkflowId,
    }),
  ]);
  console.log('✅ Successfully fetched patch and non-patch runs for preparation workflows.');

  const runsToCancel = patchRuns.data.workflow_runs
    .concat(nonPatchRuns.data.workflow_runs)
    .filter(({ status }) =>
      ['in_progress', 'pending', 'queued', 'requested', 'waiting'].includes(status)
    );

  if (runsToCancel.length === 0) {
    console.log('👍 No runs to cancel.');
    return;
  }

  console.log(`🔍 Found ${runsToCancel.length} runs to cancel. Cancelling them now:
    ${runsToCancel
      .map(
        (r) =>
          `${picocolors.green(r.path)} - ${picocolors.green(r.id)}: ${picocolors.blue(r.status)}`
      )
      .join('\n    ')}`);

  const result = await Promise.allSettled(
    runsToCancel.map((r) =>
      githubRestClient('POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel', {
        owner: 'storybookjs',
        repo: 'storybook',
        run_id: r.id,
      })
    )
  );

  if (result.some((r) => r.status === 'rejected')) {
    console.warn('⚠️ Some runs could not be canceled:');
    result.forEach((r, index) => {
      if (r.status === 'rejected') {
        console.warn(`Run ID: ${runsToCancel[index].id} - Reason: ${r.reason}`);
      }
    });
  } else {
    console.log('✅ Successfully canceled all preparation runs.');
  }
};

if (esMain(import.meta.url)) {
  run().catch((err) => {
    console.error(err);
    // this is non-critical work, so we don't want to fail the CI build if this fails
  });
}
