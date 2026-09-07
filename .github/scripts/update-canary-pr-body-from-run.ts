import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCanaryRefStepName, type ResolvedCanaryRef } from './resolve-canary-ref.ts';
import { replaceMarker } from './replace-pr-body-markers.ts';

export const PUBLISH_JOB_NAME = 'Publish Canary Packages';
export const PKG_PR_NEW_DASHBOARD = 'https://pkg.pr.new/~/storybookjs/storybook';
export const HEADING_MARKER = 'CANARY_RELEASE_HEADING';
export const SECTION_MARKER = 'CANARY_RELEASE_SECTION';

export type JobConclusion = {
  name: string;
  conclusion: string | null;
  steps?: { name: string; conclusion: string | null }[];
};

export type AssociatedPull = {
  number: number;
  state: string;
  head: { sha: string };
};

export type WorkflowRunView = {
  event: string;
  conclusion: string | null;
  headSha: string;
  jobs: JobConclusion[];
};

export type CanaryPrBodyAction =
  | { action: 'skip'; reason: string }
  | { action: 'released' }
  | { action: 'failed' };

export type GhClient = (args: string[], input?: string) => string;

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function decideCanaryPrBodyAction(input: {
  event: string;
  runConclusion: string | null;
  jobs: JobConclusion[];
}): CanaryPrBodyAction {
  if (input.event !== 'pull_request' && input.event !== 'workflow_dispatch') {
    return {
      action: 'skip',
      reason: `event is ${input.event}, not pull_request or workflow_dispatch`,
    };
  }

  if (input.runConclusion !== 'success' && input.runConclusion !== 'failure') {
    return {
      action: 'skip',
      reason: `run conclusion is ${input.runConclusion ?? 'null'}`,
    };
  }

  const job = input.jobs.find((entry) => entry.name === PUBLISH_JOB_NAME);
  if (!job) {
    return { action: 'skip', reason: `no job named ${PUBLISH_JOB_NAME}` };
  }

  if (job.conclusion === 'success') {
    return { action: 'released' };
  }
  if (job.conclusion === 'failure' || job.conclusion === 'timed_out') {
    return { action: 'failed' };
  }

  return {
    action: 'skip',
    reason: `publish job conclusion is ${job.conclusion ?? 'null'}`,
  };
}

export function findCanaryRefFromJobs(jobs: JobConclusion[]): ResolvedCanaryRef | null {
  const job = jobs.find((entry) => entry.name === PUBLISH_JOB_NAME);
  const step = job?.steps?.find((entry) => entry.name.startsWith('canary-ref '));
  if (!step) {
    return null;
  }
  return parseCanaryRefStepName(step.name);
}

export function findPullRequestNumber(pulls: AssociatedPull[], headSha: string): number | null {
  const matches = pulls.filter((pull) => pull.state === 'open' && pull.head.sha === headSha);
  if (matches.length === 0) {
    return null;
  }
  if (matches.length > 1) {
    throw new Error(
      `multiple open PRs have head ${headSha}: ${matches.map((pull) => pull.number).join(', ')}`
    );
  }
  return matches[0].number;
}

export function buildReleasedHeading(sha: string): string {
  return `## 🦋 Canary Release - 🚢 Released [\`${shortSha(sha)}\`](${PKG_PR_NEW_DASHBOARD})`;
}

export function buildFailedHeading(sha: string): string {
  return `## 🦋 Canary Release - 💥 Failed [\`${shortSha(sha)}\`](${PKG_PR_NEW_DASHBOARD})`;
}

export function buildReleasedSection(sha: string): string {
  const short = shortSha(sha);
  return [
    'This pull request has been released as canary packages. Try it out in a new project or update an existing project with the commands below.',
    '',
    '```sh',
    '# For a new project',
    `npx --yes --allow-remote=all https://pkg.pr.new/create-storybook@${short}`,
    '',
    '# or for an existing project',
    `npx --yes --allow-remote=all https://pkg.pr.new/storybook@${short} upgrade`,
    '```',
  ].join('\n');
}

export function applyCanaryPrBodyUpdate(
  body: string,
  update: { action: 'released' | 'failed'; sha: string }
): string {
  if (update.action === 'released') {
    return replaceMarker(
      replaceMarker(body, HEADING_MARKER, buildReleasedHeading(update.sha)),
      SECTION_MARKER,
      buildReleasedSection(update.sha)
    );
  }
  return replaceMarker(body, HEADING_MARKER, buildFailedHeading(update.sha));
}

export function buildFailureComment(input: { actor: string; repo: string; runId: string }): string {
  return `Failed to publish canary packages for this pull request, triggered by @${input.actor}. See the failed workflow run at: https://github.com/${input.repo}/actions/runs/${input.runId}`;
}

export function updateCanaryPrBodyFromRun(
  input: { repo: string; runId: string; actor: string },
  gh: GhClient
): { action: CanaryPrBodyAction['action']; pr?: number; reason?: string } {
  const run = JSON.parse(
    gh([
      'run',
      'view',
      input.runId,
      '--repo',
      input.repo,
      '--json',
      'event,conclusion,headSha,jobs',
    ])
  ) as WorkflowRunView;

  const decision = decideCanaryPrBodyAction({
    event: run.event,
    runConclusion: run.conclusion,
    jobs: run.jobs,
  });

  if (decision.action === 'skip') {
    return decision;
  }

  let sha = run.headSha;
  let pr: number | null = null;

  if (run.event === 'workflow_dispatch') {
    const ref = findCanaryRefFromJobs(run.jobs);
    if (!ref) {
      return { action: 'skip', reason: 'workflow_dispatch run has no canary-ref step' };
    }
    sha = ref.sha;
    pr = ref.prNumber;
  }

  if (pr === null) {
    const pulls = JSON.parse(
      gh(['api', `repos/${input.repo}/commits/${sha}/pulls`])
    ) as AssociatedPull[];
    pr = findPullRequestNumber(pulls, sha);
    if (pr === null) {
      return { action: 'skip', reason: `no open PR with head ${sha}` };
    }
  } else {
    const pull = JSON.parse(gh(['api', `repos/${input.repo}/pulls/${pr}`])) as { state: string };
    if (pull.state !== 'open') {
      return { action: 'skip', reason: `PR #${pr} is ${pull.state}` };
    }
  }

  let body = gh(['api', `repos/${input.repo}/pulls/${pr}`, '--jq', '.body']);
  if (body.endsWith('\n')) {
    body = body.slice(0, -1);
  }

  const nextBody = applyCanaryPrBodyUpdate(body, { action: decision.action, sha });
  gh(
    ['api', '--method', 'PATCH', `repos/${input.repo}/pulls/${pr}`, '--input', '-'],
    JSON.stringify({ body: nextBody })
  );

  if (decision.action === 'failed') {
    gh([
      'pr',
      'comment',
      String(pr),
      '--repo',
      input.repo,
      '--body',
      buildFailureComment({ actor: input.actor, repo: input.repo, runId: input.runId }),
    ]);
  }

  return { action: decision.action, pr };
}

function parseArgs(argv: string[]): { repo: string; runId: string; actor: string } {
  let repo = '';
  let runId = '';
  let actor = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') {
      repo = argv[(i += 1)] ?? '';
      continue;
    }
    if (arg === '--run-id') {
      runId = argv[(i += 1)] ?? '';
      continue;
    }
    if (arg === '--actor') {
      actor = argv[(i += 1)] ?? '';
      continue;
    }
    throw new Error(`unexpected argument: ${arg}`);
  }

  if (!repo || !runId || !actor) {
    throw new Error('usage: --repo REPO --run-id ID --actor LOGIN');
  }

  return { repo, runId, actor };
}

function createGhClient(): GhClient {
  return (args: string[], input?: string): string =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'inherit'],
    });
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const result = updateCanaryPrBodyFromRun(parsed, createGhClient());
  if (result.action === 'skip') {
    console.log(`Skipping canary PR body update: ${result.reason}`);
    return;
  }
  console.log(`Updated PR #${result.pr} canary section (${result.action})`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main();
}
