import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCanaryRefStepName } from './resolve-canary-ref.ts';
import {
  applyCanaryPrBodyUpdate,
  buildFailedHeading,
  buildFailureComment,
  buildReleasedHeading,
  buildReleasedSection,
  decideCanaryPrBodyAction,
  findCanaryRefFromJobs,
  findPullRequestNumber,
  PUBLISH_JOB_NAME,
  shortSha,
  updateCanaryPrBodyFromRun,
  type GhClient,
} from './update-canary-pr-body-from-run.ts';

const SHA = 'cc789cec620ac79919c58cb889bc68db3522d429';
const TEMPLATE = `intro

<!-- CANARY_RELEASE_HEADING -->
## 🦋 Canary Release - 🚫 Not run
<!-- CANARY_RELEASE_HEADING -->

<!-- CANARY_RELEASE_SECTION -->
placeholder
<!-- CANARY_RELEASE_SECTION -->
`;

test('decideCanaryPrBodyAction skips non-pull_request events', () => {
  assert.deepEqual(
    decideCanaryPrBodyAction({
      event: 'push',
      runConclusion: 'success',
      jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'success' }],
    }),
    { action: 'skip', reason: 'event is push, not pull_request or workflow_dispatch' }
  );
});

test('decideCanaryPrBodyAction skips cancelled and skipped runs', () => {
  assert.equal(
    decideCanaryPrBodyAction({
      event: 'pull_request',
      runConclusion: 'cancelled',
      jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'cancelled' }],
    }).action,
    'skip'
  );
  assert.equal(
    decideCanaryPrBodyAction({
      event: 'pull_request',
      runConclusion: 'skipped',
      jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'skipped' }],
    }).action,
    'skip'
  );
});

test('decideCanaryPrBodyAction skips unlabeled PRs whose publish job did not run', () => {
  assert.deepEqual(
    decideCanaryPrBodyAction({
      event: 'pull_request',
      runConclusion: 'skipped',
      jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'skipped' }],
    }),
    { action: 'skip', reason: 'run conclusion is skipped' }
  );
});

test('decideCanaryPrBodyAction skips when the publish job did not run but the workflow succeeded', () => {
  assert.deepEqual(
    decideCanaryPrBodyAction({
      event: 'pull_request',
      runConclusion: 'success',
      jobs: [
        { name: 'Skip fork pull request', conclusion: 'success' },
        { name: PUBLISH_JOB_NAME, conclusion: 'skipped' },
      ],
    }),
    { action: 'skip', reason: 'publish job conclusion is skipped' }
  );
});

test('decideCanaryPrBodyAction maps workflow_dispatch publish success', () => {
  assert.deepEqual(
    decideCanaryPrBodyAction({
      event: 'workflow_dispatch',
      runConclusion: 'success',
      jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'success' }],
    }),
    { action: 'released' }
  );
});

test('findCanaryRefFromJobs reads the canary-ref step', () => {
  assert.equal(findCanaryRefFromJobs([{ name: PUBLISH_JOB_NAME, conclusion: 'success' }]), null);
  assert.deepEqual(
    findCanaryRefFromJobs([
      {
        name: PUBLISH_JOB_NAME,
        conclusion: 'success',
        steps: [
          {
            name: formatCanaryRefStepName({
              sha: SHA,
              repository: 'alice/storybook',
              branch: '',
              prNumber: 34799,
            }),
            conclusion: 'success',
          },
        ],
      },
    ]),
    { sha: SHA, repository: 'alice/storybook', branch: '', prNumber: 34799 }
  );
});

test('decideCanaryPrBodyAction maps publish success and failure', () => {
  assert.deepEqual(
    decideCanaryPrBodyAction({
      event: 'pull_request',
      runConclusion: 'success',
      jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'success' }],
    }),
    { action: 'released' }
  );
  assert.deepEqual(
    decideCanaryPrBodyAction({
      event: 'pull_request',
      runConclusion: 'failure',
      jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'failure' }],
    }),
    { action: 'failed' }
  );
});

test('findPullRequestNumber requires a single open PR whose head matches the run SHA', () => {
  assert.equal(
    findPullRequestNumber([{ number: 1, state: 'closed', head: { sha: SHA } }], SHA),
    null
  );
  assert.equal(
    findPullRequestNumber([{ number: 34799, state: 'open', head: { sha: SHA } }], SHA),
    34799
  );
  assert.equal(
    findPullRequestNumber(
      [{ number: 2, state: 'open', head: { sha: 'abc'.padEnd(40, '0') } }],
      SHA
    ),
    null
  );
  assert.throws(() =>
    findPullRequestNumber(
      [
        { number: 1, state: 'open', head: { sha: SHA } },
        { number: 2, state: 'open', head: { sha: SHA } },
      ],
      SHA
    )
  );
});

test('released markdown uses compact pkg.pr.new URLs from the run SHA', () => {
  const short = shortSha(SHA);
  assert.equal(
    buildReleasedHeading(SHA),
    `## 🦋 Canary Release - 🚢 Released [\`${short}\`](https://pkg.pr.new/~/storybookjs/storybook)`
  );
  assert.match(buildReleasedSection(SHA), new RegExp(`create-storybook@${short}`));
  assert.match(buildReleasedSection(SHA), new RegExp(`storybook@${short} upgrade`));
  assert.doesNotMatch(buildReleasedSection(SHA), /owner\/repo/);
});

test('applyCanaryPrBodyUpdate replaces heading and section for a release', () => {
  const next = applyCanaryPrBodyUpdate(TEMPLATE, { action: 'released', sha: SHA });
  assert.match(next, /Released \[\`cc789ce\`\]/);
  assert.match(
    next,
    /npx --yes --allow-remote=all https:\/\/pkg\.pr\.new\/storybook@cc789ce upgrade/
  );
  assert.match(next, /<!-- CANARY_RELEASE_HEADING -->/);
  assert.match(next, /<!-- CANARY_RELEASE_SECTION -->/);
});

test('applyCanaryPrBodyUpdate only replaces the heading on failure', () => {
  const next = applyCanaryPrBodyUpdate(TEMPLATE, { action: 'failed', sha: SHA });
  assert.match(next, /Failed \[\`cc789ce\`\]/);
  assert.match(next, /placeholder/);
});

test('updateCanaryPrBodyFromRun patches the matching PR and comments on failure', () => {
  const calls: { args: string[]; input?: string }[] = [];
  const gh: GhClient = (args, input) => {
    calls.push({ args, input });
    if (args[0] === 'run' && args[1] === 'view') {
      return JSON.stringify({
        event: 'pull_request',
        conclusion: 'failure',
        headSha: SHA,
        jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'failure' }],
      });
    }
    if (args[0] === 'api' && args[1]?.includes('/commits/')) {
      return JSON.stringify([{ number: 34799, state: 'open', head: { sha: SHA } }]);
    }
    if (
      args[0] === 'api' &&
      args[1] === 'repos/storybookjs/storybook/pulls/34799' &&
      !args.includes('PATCH')
    ) {
      return TEMPLATE;
    }
    return '';
  };

  const result = updateCanaryPrBodyFromRun(
    { repo: 'storybookjs/storybook', runId: '99', actor: 'jeppe' },
    gh
  );

  assert.deepEqual(result, { action: 'failed', pr: 34799 });
  const patch = calls.find((call) => call.args.includes('PATCH'));
  assert.ok(patch?.input?.includes(buildFailedHeading(SHA)));
  const comment = calls.find((call) => call.args[0] === 'pr' && call.args[1] === 'comment');
  assert.equal(
    comment?.args.at(-1),
    buildFailureComment({ actor: 'jeppe', repo: 'storybookjs/storybook', runId: '99' })
  );
});

test('updateCanaryPrBodyFromRun uses the canary-ref SHA on workflow_dispatch, not the dropdown head', () => {
  const dropdownSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const calls: { args: string[]; input?: string }[] = [];
  const gh: GhClient = (args, input) => {
    calls.push({ args, input });
    if (args[0] === 'run' && args[1] === 'view') {
      return JSON.stringify({
        event: 'workflow_dispatch',
        conclusion: 'success',
        headSha: dropdownSha,
        jobs: [
          {
            name: PUBLISH_JOB_NAME,
            conclusion: 'success',
            steps: [
              {
                name: formatCanaryRefStepName({
                  sha: SHA,
                  repository: 'alice/storybook',
                  branch: '',
                  prNumber: 34799,
                }),
                conclusion: 'success',
              },
            ],
          },
        ],
      });
    }
    if (
      args[0] === 'api' &&
      args[1] === 'repos/storybookjs/storybook/pulls/34799' &&
      args.includes('--jq')
    ) {
      return TEMPLATE;
    }
    if (args[0] === 'api' && args[1] === 'repos/storybookjs/storybook/pulls/34799') {
      return JSON.stringify({ state: 'open' });
    }
    return '';
  };

  const result = updateCanaryPrBodyFromRun(
    { repo: 'storybookjs/storybook', runId: '88', actor: 'jeppe' },
    gh
  );

  assert.deepEqual(result, { action: 'released', pr: 34799 });
  const patch = calls.find((call) => call.args.includes('PATCH'));
  assert.ok(patch?.input?.includes(buildReleasedHeading(SHA)));
  assert.equal(
    calls.some((call) => call.args[1]?.includes(dropdownSha)),
    false
  );
});

test('updateCanaryPrBodyFromRun skips workflow_dispatch without a canary-ref step', () => {
  const gh: GhClient = (args) => {
    if (args[0] === 'run') {
      return JSON.stringify({
        event: 'workflow_dispatch',
        conclusion: 'success',
        headSha: SHA,
        jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'success', steps: [] }],
      });
    }
    throw new Error(`unexpected gh call: ${args.join(' ')}`);
  };

  assert.deepEqual(
    updateCanaryPrBodyFromRun({ repo: 'storybookjs/storybook', runId: '2', actor: 'bot' }, gh),
    { action: 'skip', reason: 'workflow_dispatch run has no canary-ref step' }
  );
});

test('updateCanaryPrBodyFromRun ignores a PR number that does not match the run head SHA', () => {
  const gh: GhClient = (args) => {
    if (args[0] === 'run') {
      return JSON.stringify({
        event: 'pull_request',
        conclusion: 'success',
        headSha: SHA,
        jobs: [{ name: PUBLISH_JOB_NAME, conclusion: 'success' }],
      });
    }
    if (args[0] === 'api' && args[1]?.includes('/commits/')) {
      return JSON.stringify([
        { number: 1, state: 'open', head: { sha: 'deadbeef'.padEnd(40, '0') } },
      ]);
    }
    throw new Error(`unexpected gh call: ${args.join(' ')}`);
  };

  assert.deepEqual(
    updateCanaryPrBodyFromRun({ repo: 'storybookjs/storybook', runId: '1', actor: 'bot' }, gh),
    { action: 'skip', reason: `no open PR with head ${SHA}` }
  );
});
