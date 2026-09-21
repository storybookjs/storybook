// Disposable experiment for the agent-eval review-thread merge gate.
// Runs on a throwaway PR with the workflow GITHUB_TOKEN and records, to the run
// log, exactly what works under the workflow's declared permissions.
// Idempotent: re-runs detect the existing marker comment instead of creating duplicates.

const MARKER = '<!-- agent-eval-gate -->';
const REPO = 'storybookjs/storybook';
const [OWNER, NAME] = REPO.split('/');
const PR_NUMBER = Number(process.env.PR_NUMBER);
const HEAD_SHA = process.env.HEAD_SHA || '';
const ANCHOR_PATH = process.env.ANCHOR_PATH || 'tmp-experiment-review-thread-gate.md';
const PERMS = process.env.WORKFLOW_PERMS || 'unknown';
const RUN_ID = process.env.GITHUB_RUN_ID || 'local';
const TOKEN = process.env.GITHUB_TOKEN;
const API = 'https://api.github.com';

if (!TOKEN || !PR_NUMBER) {
  console.error('Missing GITHUB_TOKEN or PR_NUMBER');
  process.exit(1);
}

const restHeaders = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'tmp-thread-experiment',
};

async function rest(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...restHeaders, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

async function gql(query, variables) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { ...restHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json().catch(() => null);
}

const findings = [];
function record(op, data) {
  findings.push({ op, ...data });
  console.log(`FINDING ${JSON.stringify({ op, ...data })}`);
}

const THREADS_QUERY = `
query($owner:String!,$name:String!,$number:Int!){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      headRefOid
      mergeStateStatus
      mergeable
      reviewDecision
      reviewThreads(first:100){
        nodes{
          id
          path
          line
          startLine
          isResolved
          isOutdated
          isCollapsed
          subjectType
          comments(first:10){ nodes{ databaseId body author{ login } } }
        }
      }
    }
  }
}`;

// subjectType/isCollapsed may not exist on ReviewThread in the schema; fall back.
const THREADS_QUERY_MINIMAL = `
query($owner:String!,$name:String!,$number:Int!){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      headRefOid
      mergeStateStatus
      mergeable
      reviewDecision
      reviewThreads(first:100){
        nodes{
          id
          path
          line
          isResolved
          isOutdated
          comments(first:10){ nodes{ databaseId body author{ login } } }
        }
      }
    }
  }
}`;

async function fetchPull() {
  const vars = { owner: OWNER, name: NAME, number: PR_NUMBER };
  let result = await gql(THREADS_QUERY, vars);
  if (result?.errors && !result.data) {
    record('graphql-threads-query-full', {
      note: 'full query failed, retrying minimal',
      errors: JSON.stringify(result.errors).slice(0, 500),
    });
    result = await gql(THREADS_QUERY_MINIMAL, vars);
  }
  return result;
}

const RESOLVE_MUT = `mutation($thread:ID!){ resolveReviewThread(input:{threadId:$thread}){ thread{ id isResolved } } }`;
const UNRESOLVE_MUT = `mutation($thread:ID!){ unresolveReviewThread(input:{threadId:$thread}){ thread{ id isResolved } } }`;

const trim = (s) => (s ? String(s).slice(0, 300) : null);

async function main() {
  record('run-meta', {
    permissions: PERMS,
    event: process.env.GITHUB_EVENT_NAME || 'unknown',
    runId: RUN_ID,
    headSha: HEAD_SHA ? HEAD_SHA.slice(0, 10) : null,
  });

  // 1. Idempotent creation: only create if no comment carries the marker.
  const existing = await rest('GET', `/repos/${REPO}/pulls/${PR_NUMBER}/comments?per_page=100`);
  const markerComment = (Array.isArray(existing.json) ? existing.json : []).find((c) =>
    c.body?.includes(MARKER)
  );
  let markerCommentDbId = markerComment?.id ?? null;

  if (markerComment) {
    record('create-comment', {
      skipped: true,
      note: 'marker comment already exists (idempotent skip)',
      commentDatabaseId: markerCommentDbId,
      author: markerComment.author?.login ?? null,
    });
  } else {
    const commentBody = `${MARKER}\nagent-eval merge-gate experiment thread. Created by tmp-thread-experiment.yml on a disposable PR.`;
    // Attempt A: minimal payload — body, path, subject_type FILE. No commit_id, no line.
    let r = await rest('POST', `/repos/${REPO}/pulls/${PR_NUMBER}/comments`, {
      body: commentBody,
      path: ANCHOR_PATH,
      subject_type: 'FILE',
    });
    record('create-comment-minimal', {
      request: 'POST /repos/{owner}/{repo}/pulls/{n}/comments {body, path, subject_type:"FILE"} — no commit_id, no line',
      permissions: PERMS,
      status: r.status,
      ok: r.status < 300,
      error: r.status < 300 ? null : trim(r.json?.message ?? JSON.stringify(r.json)),
      responseFields:
        r.status < 300
          ? {
              id: r.json?.id ?? null,
              hasNodeId: !!r.json?.node_id,
              path: r.json?.path ?? null,
              line: r.json?.line ?? null,
              subjectType: r.json?.subject_type ?? null,
              commitIdEcho: r.json?.commit_id ? String(r.json.commit_id).slice(0, 10) : null,
              author: r.json?.user?.login ?? null,
            }
          : null,
    });
    if (r.status >= 300) {
      // Attempt B: add commit_id (PR head SHA).
      r = await rest('POST', `/repos/${REPO}/pulls/${PR_NUMBER}/comments`, {
        body: commentBody,
        commit_id: HEAD_SHA,
        path: ANCHOR_PATH,
        subject_type: 'FILE',
      });
      record('create-comment-with-commit-id', {
        request: 'POST /pulls/{n}/comments {body, commit_id: headSha, path, subject_type:"FILE"}',
        permissions: PERMS,
        status: r.status,
        ok: r.status < 300,
        error: r.status < 300 ? null : trim(r.json?.message ?? JSON.stringify(r.json)),
      });
      if (r.status >= 300) {
        // Attempt C: last resort — anchor to line 1 so a thread exists at all.
        r = await rest('POST', `/repos/${REPO}/pulls/${PR_NUMBER}/comments`, {
          body: commentBody,
          commit_id: HEAD_SHA,
          path: ANCHOR_PATH,
          subject_type: 'FILE',
          line: 1,
          side: 'RIGHT',
        });
        record('create-comment-with-line', {
          request: 'POST /pulls/{n}/comments {body, commit_id, path, subject_type:"FILE", line:1, side:"RIGHT"}',
          permissions: PERMS,
          status: r.status,
          ok: r.status < 300,
          error: r.status < 300 ? null : trim(r.json?.message ?? JSON.stringify(r.json)),
        });
      }
    }
    if (r.status < 300 && r.json) {
      markerCommentDbId = r.json.id;
    }
  }

  // 2. GraphQL: does the standalone comment appear as a review thread?
  const pull = await fetchPull();
  const pr = pull?.data?.repository?.pullRequest ?? null;
  const threads = pr?.reviewThreads?.nodes ?? [];
  const mine = threads.find((t) => (t.comments?.nodes ?? []).some((c) => c.body?.includes(MARKER))) ?? null;
  record('reviewThreads-lookup', {
    threadCount: threads.length,
    markerThreadFound: !!mine,
    threadId: mine?.id ?? null,
    path: mine?.path ?? null,
    line: mine?.line ?? null,
    subjectType: mine && 'subjectType' in mine ? mine.subjectType : 'field-not-returned',
    isResolved: mine?.isResolved ?? null,
    isOutdated: mine?.isOutdated ?? null,
    commentAuthor: mine?.comments?.nodes?.[0]?.author?.login ?? null,
    mergeStateStatus: pr?.mergeStateStatus ?? null,
    mergeable: pr?.mergeable ?? null,
    reviewDecision: pr?.reviewDecision ?? null,
    graphQLErrors: pull?.errors ? trim(JSON.stringify(pull.errors)) : null,
  });

  // 3. resolveReviewThread under the current permission set.
  let resolveOk = false;
  let resolveError = null;
  if (mine) {
    const r = await gql(RESOLVE_MUT, { thread: mine.id });
    resolveOk = !!r?.data?.resolveReviewThread;
    resolveError = r?.errors ? trim(JSON.stringify(r.errors)) : null;
    record('resolveReviewThread', {
      permissions: PERMS,
      ok: resolveOk,
      isResolved: r?.data?.resolveReviewThread?.thread?.isResolved ?? null,
      error: resolveError,
    });
  } else {
    record('resolveReviewThread', { permissions: PERMS, ok: false, error: 'marker thread not found' });
  }

  // 4. If resolved: observe merge state, unresolve, observe again.
  let unresolveOk = false;
  if (resolveOk) {
    const afterResolve = await fetchPull();
    const t1 = afterResolve?.data?.repository?.pullRequest?.reviewThreads?.nodes?.find((t) => t.id === mine.id);
    record('state-after-resolve', {
      isResolved: t1?.isResolved ?? null,
      mergeStateStatus: afterResolve?.data?.repository?.pullRequest?.mergeStateStatus ?? null,
      mergeable: afterResolve?.data?.repository?.pullRequest?.mergeable ?? null,
    });
    const r = await gql(UNRESOLVE_MUT, { thread: mine.id });
    unresolveOk = !!r?.data?.unresolveReviewThread;
    record('unresolveReviewThread', {
      permissions: PERMS,
      ok: unresolveOk,
      isResolved: r?.data?.unresolveReviewThread?.thread?.isResolved ?? null,
      error: r?.errors ? trim(JSON.stringify(r.errors)) : null,
    });
    if (unresolveOk) {
      const afterUnresolve = await fetchPull();
      const t2 = afterUnresolve?.data?.repository?.pullRequest?.reviewThreads?.nodes?.find((t) => t.id === mine.id);
      record('state-after-unresolve', {
        isResolved: t2?.isResolved ?? null,
        mergeStateStatus: afterUnresolve?.data?.repository?.pullRequest?.mergeStateStatus ?? null,
        mergeable: afterUnresolve?.data?.repository?.pullRequest?.mergeable ?? null,
      });
    }
  } else {
    record('unresolveReviewThread', {
      permissions: PERMS,
      ok: false,
      skipped: true,
      note: 'resolve did not succeed; unresolve not attempted',
    });
  }

  // 5. PATCH the marker comment: append this run's outcome to the body.
  if (markerCommentDbId) {
    const cur = await rest('GET', `/repos/${REPO}/pulls/comments/${markerCommentDbId}`);
    const baseBody = cur.status < 300 && cur.json?.body ? cur.json.body : `${MARKER}\nagent-eval merge-gate experiment thread.`;
    const line = `\n- run ${RUN_ID} [${PERMS}]: resolve=${
      resolveOk ? 'ok' : `FAILED ${trim(resolveError)?.slice(0, 160) ?? ''}`
    }${resolveOk ? `, unresolve=${unresolveOk ? 'ok' : 'FAILED'}` : ''}`;
    const r = await rest('PATCH', `/repos/${REPO}/pulls/comments/${markerCommentDbId}`, {
      body: `${baseBody}${line}`,
    });
    record('patch-comment', {
      permissions: PERMS,
      status: r.status,
      ok: r.status < 300,
      error: r.status < 300 ? null : trim(r.json?.message ?? JSON.stringify(r.json)),
    });
  }

  // 6. Emit findings for the run log and step summary.
  const block = JSON.stringify(findings, null, 2);
  console.log('===THREAD-EXPERIMENT-FINDINGS-BEGIN===');
  console.log(block);
  console.log('===THREAD-EXPERIMENT-FINDINGS-END===');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import('node:fs');
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      ['### tmp-thread-experiment findings', '```json', block, '```'].join('\n')
    );
  }
}

main().catch((err) => {
  console.error('EXPERIMENT_FATAL', err);
  process.exit(1);
});
