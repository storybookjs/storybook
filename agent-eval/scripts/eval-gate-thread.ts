#!/usr/bin/env node
// Maintains the review thread that is the merge proof for the `agent-eval:eval` label. The first
// comment of the thread carries MARKER, so every run finds and updates the same thread.
//
//   eval-gate-thread.ts ensure --pr <n> --sha <head> --run-url <url> [--scope <labels>]
//     Before evals run: create the thread, or reset its body and reopen it. Fails the job on error,
//     because without the thread there is no merge proof.
//
//   eval-gate-thread.ts result --pr <n> --sha <head> --outcome <outcome> [--run-url <url>]
//                              [--playground-url <url>] [--summary-file <path>]
//     After evals: resolve the thread when evals passed for the live PR head, otherwise write the
//     outcome and keep it open. Only warns on error, so it cannot fail a finished eval run.
//
//   eval-gate-thread.ts reopen --pr <n> --sha <new head>
//     On push: reopen the thread for the new head, without running evals. Fails the job on error,
//     because GitHub does not reopen a resolved thread on push.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { gh, ghJson } from '../../scripts/utils/gh.ts';

const MARKER = '<!-- agent-eval-gate -->';
const RERUN_HINT =
  'To run evals again, remove and re-add the `agent-eval:eval` label, or run the Agent eval workflow with `workflow_dispatch` on this branch (set `pr_number` if the branch has more than one open PR).';

const THREADS_QUERY = `query($owner: String!, $repo: String!, $pr: Int!, $endCursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id isResolved comments(first: 1) { nodes { databaseId body author { login } } } }
      }
    }
  }
}`;

interface ThreadsPage {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: {
            id: string;
            isResolved: boolean;
            comments: {
              nodes: { databaseId: number; body: string; author: { login: string } | null }[];
            };
          }[];
        };
      };
    };
  };
}

interface GateThread {
  threadId: string;
  commentId: number;
  isResolved: boolean;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    pr: { type: 'string' },
    sha: { type: 'string' },
    'run-url': { type: 'string' },
    'playground-url': { type: 'string' },
    scope: { type: 'string' },
    outcome: { type: 'string' },
    'summary-file': { type: 'string' },
    actor: { type: 'string' },
  },
});
const [command] = positionals;
const pr = values.pr || fail('--pr is required');
const sha = values.sha || fail('--sha is required');
const repository = process.env.GITHUB_REPOSITORY || fail('GITHUB_REPOSITORY is not set');
const [owner, repo] = repository.split('/');

function fail(message: string): never {
  console.log(`::error title=Eval gate::${message}`);
  process.exit(1);
}

function warn(message: string) {
  console.log(`::warning title=Eval gate::${message}`);
}

function attempt<T>(action: () => T, failureMessage: string): T | undefined {
  try {
    return action();
  } catch (error) {
    warn(`${failureMessage} ${(error as Error).message}`);
    return undefined;
  }
}

function locateThread(): GateThread | null {
  const pages = ghJson<ThreadsPage[]>([
    'api',
    'graphql',
    '--paginate',
    '--slurp',
    '-f',
    `query=${THREADS_QUERY}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `repo=${repo}`,
    '-F',
    `pr=${pr}`,
  ]);
  const thread = pages
    .flatMap((page) => page.data.repository.pullRequest.reviewThreads.nodes)
    .find(
      (node) =>
        node.comments.nodes[0]?.author?.login === 'github-actions' &&
        node.comments.nodes[0].body.startsWith(MARKER)
    );
  if (!thread) {
    return null;
  }
  return {
    threadId: thread.id,
    commentId: thread.comments.nodes[0]!.databaseId,
    isResolved: thread.isResolved,
  };
}

// A file-level review comment needs a file that still exists in the diff.
function pickAnchorPath(): string {
  const files = ghJson<{ filename: string; status: string }[][]>([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repository}/pulls/${pr}/files?per_page=100`,
  ]).flat();
  const anchor = files.find(({ status }) => status !== 'removed') ?? files[0];
  return anchor?.filename ?? fail(`Cannot anchor the gate thread: PR #${pr} has no changed files.`);
}

function createComment(body: string) {
  gh(['api', '--method', 'POST', `repos/${repository}/pulls/${pr}/comments`, '--input', '-'], {
    input: JSON.stringify({ body, path: pickAnchorPath(), commit_id: sha, subject_type: 'file' }),
  });
}

function updateComment(commentId: number, body: string) {
  gh(
    ['api', '--method', 'PATCH', `repos/${repository}/pulls/comments/${commentId}`, '--input', '-'],
    {
      input: JSON.stringify({ body }),
    }
  );
  return commentId;
}

function setThreadResolved(threadId: string, resolved: boolean) {
  const mutation = resolved ? 'resolveReviewThread' : 'unresolveReviewThread';
  gh([
    'api',
    'graphql',
    '-f',
    `query=mutation($id: ID!) { ${mutation}(input: { threadId: $id }) { thread { id } } }`,
    '-f',
    `id=${threadId}`,
  ]);
  return threadId;
}

function livePrHead(): string {
  return (
    gh(['api', `repos/${repository}/pulls/${pr}`, '--jq', '.head.sha'], {
      encoding: 'utf8',
    }) as string
  ).trim();
}

function short(commitSha: string) {
  return commitSha.slice(0, 7);
}

function gateBody(status: string, ...lines: string[]) {
  return [MARKER, '### Agent eval gate', '', `**${status}**`, '', ...lines].join('\n');
}

function resultLinks() {
  return [
    `- Eval run: ${values['run-url'] || 'n/a'}`,
    `- Playground: ${values['playground-url'] || 'not deployed'}`,
  ];
}

function ensure() {
  const scope = values.scope
    ? `\`agent-eval:eval\` + ${values.scope}`
    : '`agent-eval:eval` (default smoke eval)';
  const body = gateBody(
    `Status: evals required for head \`${short(sha)}\``,
    `- Scope: ${scope}`,
    `- Eval run: ${values['run-url'] || 'n/a'}`,
    '',
    'This thread is the merge proof for the `agent-eval:eval` label. The Agent eval workflow resolves it when evals pass for the current PR head, and reopens it when new commits are pushed.',
    '',
    RERUN_HINT
  );

  const thread = locateThread();
  if (!thread) {
    createComment(body);
    return;
  }
  updateComment(thread.commentId, body);
  if (thread.isResolved) {
    setThreadResolved(thread.threadId, false);
  }
}

function result() {
  const thread = attempt(locateThread, 'Locating the gate thread failed, leaving it untouched.');
  if (thread === undefined) {
    return;
  }
  if (thread === null) {
    warn(`No gate thread found on PR #${pr}, so there is nothing to update.`);
    return;
  }

  const writeBody = (body: string) =>
    attempt(() => updateComment(thread.commentId, body), 'Updating the gate thread failed.');
  const markStale = (head: string) =>
    writeBody(
      gateBody(
        `Status: stale. Evals passed for head \`${short(sha)}\`, but the PR head is now \`${short(head)}\``,
        ...resultLinks(),
        '',
        RERUN_HINT
      )
    );

  if (values.outcome !== 'success') {
    writeBody(
      gateBody(
        `Status: evals did not pass for head \`${short(sha)}\` (outcome: \`${values.outcome || 'unknown'}\`)`,
        ...resultLinks(),
        '',
        RERUN_HINT
      )
    );
    return;
  }

  const head = attempt(
    livePrHead,
    'Fetching the live PR head failed, leaving the gate thread open.'
  );
  if (head === undefined) {
    return;
  }
  if (head !== sha) {
    markStale(head);
    return;
  }

  const summaryFile = values['summary-file'];
  const summary =
    summaryFile && existsSync(summaryFile) ? readFileSync(summaryFile, 'utf8').trim() : '';
  writeBody(
    gateBody(`Status: passed for head \`${short(sha)}\``, ...(summary ? [summary] : resultLinks()))
  );

  if (
    !attempt(() => setThreadResolved(thread.threadId, true), 'Resolving the gate thread failed.')
  ) {
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Eval gate thread\n\nEvals passed for head \`${short(sha)}\`, but resolving the gate thread failed. Run the workflow again, or resolve the thread by hand.\n`
      );
    }
    return;
  }

  // The reopen job can run for a push that landed while this run was resolving the thread.
  const headAfterResolve = attempt(livePrHead, 'Checking the PR head after resolving failed.');
  if (headAfterResolve !== undefined && headAfterResolve !== sha) {
    attempt(() => setThreadResolved(thread.threadId, false), 'Reopening the gate thread failed.');
    markStale(headAfterResolve);
  }
}

function reopen() {
  const thread = locateThread();
  if (!thread) {
    console.log(
      `No gate thread on PR #${pr}, so evals never started and there is nothing to reopen.`
    );
    return;
  }
  updateComment(
    thread.commentId,
    gateBody(
      `Status: evals required for new head \`${short(sha)}\``,
      'New commits were pushed, so the previous eval result does not cover this PR anymore. Pushing does not run evals again.',
      '',
      RERUN_HINT
    )
  );
  if (thread.isResolved) {
    setThreadResolved(thread.threadId, false);
  }
}

function optOut() {
  const thread = locateThread();
  if (!thread) {
    console.log(`No gate thread on PR #${pr}, so there is nothing to resolve.`);
    return;
  }
  updateComment(
    thread.commentId,
    gateBody(
      `Status: not required. \`agent-eval:eval\` was removed by ${values.actor || 'someone'}`,
      'Add the `agent-eval:eval` label again to run evals for this PR.'
    )
  );
  if (!thread.isResolved) {
    setThreadResolved(thread.threadId, true);
  }
}

const commands: Record<string, () => void> = { ensure, result, reopen, 'opt-out': optOut };
const run =
  commands[command ?? ''] ??
  fail('Usage: eval-gate-thread.ts <ensure|result|reopen|opt-out> [options]');
try {
  run();
} catch (error) {
  const message = `${command} failed on PR #${pr}: ${(error as Error).message}`;
  if (command === 'result') {
    warn(message);
  } else {
    fail(message);
  }
}
