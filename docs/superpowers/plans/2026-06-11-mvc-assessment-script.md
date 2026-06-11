# MVC Assessment Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node CLI under `scripts/sustainability/` that assesses a single Storybook PR against the six MVC criteria, posts a tailored review (COMMENT on PASS, REQUEST_CHANGES on FAIL), and manages `mvc:*` labels. Ship the CLI plus a thin GitHub Actions workflow and an agent skill that wraps it.

**Architecture:** One CLI entry (`assess-mvc.ts`) orchestrates a deterministic phase (PR + linked-issue fetch, precomputes, Check 1 and Check 3) and an LLM phase (Checks 2/4/5/6 in parallel + a synthesis call). The deterministic phase always runs; if any deterministic check FAILs, the LLM phase is skipped and the review body says which checks were not performed. GitHub I/O lives behind small DI-friendly modules (`github/*.ts`) backed by `@octokit/graphql` + `@octokit/request`. The LLM layer lives behind a single client (`llm/client.ts`) that the checks consume. Output is always printed; writes only happen with `--no-dry-run`.

**Tech Stack:** Node 22+ native TS (no jiti), `commander` (CLI), `picocolors` (output), `@octokit/graphql` + `@octokit/request`, `@anthropic-ai/claude-agent-sdk`, `typescript` (compiler API for cyclomatic), vitest for tests. Reach for `zod` only where commander cannot give us the runtime check we need (e.g., the union of `--model` values is straightforward enum; we use commander's `choices`).

**Conventions to honor in every task:**

- All TS relative imports use the explicit `.ts` extension (per AGENTS.md and existing `scripts/eval/` code).
- Tests live next to source: `foo.ts` ↔ `foo.test.ts`. Vitest project is `scripts` (`yarn test` from repo root runs them).
- Tests favor pure functions with dependency injection — no real network calls. Octokit clients are injected through narrow interfaces; the LLM client is injected through a `LlmClient` interface. Where filesystem access is unavoidable, use `memfs` per AGENTS.md (none of this script needs FS, but if you reach for `node:fs` stop and re-check).
- Commit message style matches the branch's existing commit (`Add implem spec`): short, sentence-cased, no `feat:`/`fix:` prefix.
- Run `yarn fmt:write` from the repo root before each commit; the pre-commit hook will also format.
- Lint with `yarn --cwd code lint:js:cmd ../scripts/sustainability/<changed-file> --fix` after large changes — note the lint script runs from `code/` and the path is relative to `code/`, so the relative path crosses into `../scripts/...`.

**Testing strategy:**

- Pure-function unit tests for parsing, classification, precomputes, label diffing, output rendering.
- Behavior tests for each check that inject a fake `GithubClient` (and fake `LlmClient` for LLM checks). Assertions verify the returned `CheckResult` (status + evidence + guidance shape) against the spec's rubric. We do not assert on the exact LLM prompt strings beyond a smoke "contains the PR title" — we test behavior, not prose.
- The CLI itself gets one integration-style test that wires fake clients end-to-end and asserts on the verdict + composed review body for a known PASS fixture and a known early-abort FAIL fixture.
- Per AGENTS.md "Test contracts (including side effects), not private implementation details" — we test what the script writes (labels added/removed, review event type, marker present in body), not how it composed each prompt.

---

## File Structure

| Path                                                               | Responsibility                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `scripts/sustainability/assess-mvc.ts`                             | CLI entry. Parse args with commander; orchestrate phases; print output.                                                   |
| `scripts/sustainability/assess-mvc/types.ts`                       | `CheckStatus`, `CheckId`, `CheckResult`, `AssessmentResult`, `Verdict`, `PrContext` (resolved PR + linked issues + diff). |
| `scripts/sustainability/assess-mvc/config.ts`                      | Constants: org, repo, marker text, maintainer team slugs, label names.                                                    |
| `scripts/sustainability/assess-mvc/github/client.ts`               | `createGithubClient(token)` returns `{ graphql, rest }` defaults-wrapped clients.                                         |
| `scripts/sustainability/assess-mvc/github/pr.ts`                   | Resolve PR (number or URL) → metadata, body, head SHA, files (diff).                                                      |
| `scripts/sustainability/assess-mvc/github/linked-issues.ts`        | GraphQL `closingIssuesReferences` + PR-body parser → resolved issues (`storybookjs/*` only).                              |
| `scripts/sustainability/assess-mvc/github/labels.ts`               | Add/remove labels with set-diff semantics.                                                                                |
| `scripts/sustainability/assess-mvc/github/review.ts`               | Submit review with marker; optionally dismiss prior bot reviews.                                                          |
| `scripts/sustainability/assess-mvc/github/teams.ts`                | Resolve maintainer-team membership (used by skip rules).                                                                  |
| `scripts/sustainability/assess-mvc/github/reactions.ts`            | Fetch issue reactions (`+1`, `-1`, `tada`).                                                                               |
| `scripts/sustainability/assess-mvc/precomputes/diff-metrics.ts`    | LOC added/removed/net + file path counts.                                                                                 |
| `scripts/sustainability/assess-mvc/precomputes/dependencies.ts`    | Parse `package.json` patch → added runtime/peer deps.                                                                     |
| `scripts/sustainability/assess-mvc/precomputes/cyclomatic.ts`      | TS compiler API walker over changed JS/TS files → per-function complexity.                                                |
| `scripts/sustainability/assess-mvc/checks/human-monitored.ts`      | Check 1 (deterministic).                                                                                                  |
| `scripts/sustainability/assess-mvc/checks/duplicate.ts`            | Check 3 (deterministic).                                                                                                  |
| `scripts/sustainability/assess-mvc/checks/real-problem.ts`         | Check 2 (LLM).                                                                                                            |
| `scripts/sustainability/assess-mvc/checks/cost-benefit.ts`         | Check 4 (LLM + precomputes).                                                                                              |
| `scripts/sustainability/assess-mvc/checks/explains-how-to-test.ts` | Check 5 (LLM).                                                                                                            |
| `scripts/sustainability/assess-mvc/checks/provides-context.ts`     | Check 6 (LLM).                                                                                                            |
| `scripts/sustainability/assess-mvc/llm/client.ts`                  | `LlmClient` interface + claude-agent-sdk implementation. Structured-output JSON helper.                                   |
| `scripts/sustainability/assess-mvc/llm/synthesis.ts`               | Compose final review body from check results + canned responses.                                                          |
| `scripts/sustainability/assess-mvc/canned-responses.ts`            | Per-criterion + overall response templates (placeholders pending author copy).                                            |
| `scripts/sustainability/assess-mvc/skip-rules.ts`                  | Resolve eligibility (draft, prior verdict label, `mvc:skip`, maintainer team).                                            |
| `scripts/sustainability/assess-mvc/output.ts`                      | Render summary table + dry-run preview block with picocolors.                                                             |
| `scripts/sustainability/assess-mvc/verdict.ts`                     | Compute `PASS`/`FAIL` from `CheckResult[]`; describe early-abort.                                                         |
| `.github/workflows/mvc-assess.yml`                                 | CI wrapper (triggers commented out initially).                                                                            |
| `.agents/skills/assess-mvc/SKILL.md`                               | Skill that documents single-PR + batch invocation.                                                                        |
| `docs/superpowers/test-conditions/2026-06-11-mvc-assessment.md`    | Validation deliverable: full test-condition matrix derived from the spec.                                                 |

---

## Phase 1 — Foundation & Deterministic Dry-Run

**Phase goal:** A working CLI that, in `--dry-run`, fetches a PR, runs the two deterministic checks, prints the summary table, and renders a placeholder review body for the LLM-deferred checks. Useful as a debug harness; not yet wired into CI.

### Task 1.1: Bootstrap directory, core types, CLI placeholder

**Files:**

- Create: `scripts/sustainability/assess-mvc.ts`
- Create: `scripts/sustainability/assess-mvc/types.ts`
- Create: `scripts/sustainability/assess-mvc/config.ts`
- Test: `scripts/sustainability/assess-mvc/types.test.ts`

- [ ] **Step 1: Write the failing type contract test**

```ts
// scripts/sustainability/assess-mvc/types.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import type { CheckResult, CheckId, CheckStatus, AssessmentResult, Verdict } from './types.ts';

describe('types', () => {
  it('exposes the six check ids', () => {
    expectTypeOf<CheckId>().toEqualTypeOf<
      'human' | 'real-problem' | 'duplicate' | 'cost-benefit' | 'explains-test' | 'provides-context'
    >();
  });

  it('exposes the four check statuses', () => {
    expectTypeOf<CheckStatus>().toEqualTypeOf<'pass' | 'fail' | 'warn' | 'deferred'>();
  });

  it('requires id/status/evidence on CheckResult, allows optional guidance', () => {
    expectTypeOf<CheckResult>().toMatchTypeOf<{
      id: CheckId;
      status: CheckStatus;
      evidence: string;
    }>();
    expectTypeOf<CheckResult['guidance']>().toEqualTypeOf<string | undefined>();
  });

  it('exposes a binary Verdict', () => {
    expectTypeOf<Verdict>().toEqualTypeOf<'pass' | 'fail'>();
  });

  it('AssessmentResult bundles verdict, results, and early-abort info', () => {
    expectTypeOf<AssessmentResult>().toMatchTypeOf<{
      verdict: Verdict;
      results: CheckResult[];
      earlyAbort: boolean;
    }>();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd /home/steve/Development/storybook && yarn vitest run --project scripts scripts/sustainability/assess-mvc/types.test.ts`
Expected: FAIL — module `./types.ts` not found.

- [ ] **Step 3: Implement `types.ts` and `config.ts`**

```ts
// scripts/sustainability/assess-mvc/types.ts
export type CheckId =
  | 'human'
  | 'real-problem'
  | 'duplicate'
  | 'cost-benefit'
  | 'explains-test'
  | 'provides-context';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'deferred';

export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  evidence: string;
  guidance?: string;
}

export type Verdict = 'pass' | 'fail';

export interface LinkedIssue {
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  reactions?: { plus1: number; minus1: number; tada: number };
}

export interface PrContext {
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  body: string;
  author: string;
  isDraft: boolean;
  headSha: string;
  labels: string[];
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
    patch?: string;
    status: string;
  }>;
  linkedIssues: LinkedIssue[];
  brokenLinkRefs: string[]; // owner/repo#n strings we tried to resolve but couldn't
}

export interface AssessmentResult {
  verdict: Verdict;
  results: CheckResult[];
  earlyAbort: boolean;
  reviewBody: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
}
```

```ts
// scripts/sustainability/assess-mvc/config.ts
export const ORG = 'storybookjs';
export const PRIMARY_REPO = 'storybook';
export const MARKER = '<!-- mvc-check:v1 -->';

export const VERDICT_LABELS = {
  pass: 'mvc:success',
  fail: 'mvc:failed',
} as const;

// Labels we manage. Any of these present and not matching the current verdict get removed.
export const MANAGED_LABELS = ['mvc:success', 'mvc:failed', 'mvc:skip', 'mvc:pending'] as const;

// Skip-rules: labels that, if present, halt the assessment.
export const SKIP_LABELS = ['mvc:success', 'mvc:failed', 'mvc:skip'] as const;

// Maintainer team slugs to query for `--respect-skip-rules`. Confirm with org admin
// before enabling triggers in the workflow (see spec section 12 open decisions).
export const MAINTAINER_TEAM_SLUGS = ['core', 'dx', 'maintainers'] as const;
```

- [ ] **Step 4: Create the CLI placeholder entry**

```ts
// scripts/sustainability/assess-mvc.ts
/**
 * MVC Assessment CLI. Phase 1 placeholder — replaced in Task 1.12.
 *
 * Runs with `node scripts/sustainability/assess-mvc.ts`. Node 22+ supports `.ts`
 * natively via type stripping; relative imports use `.ts` extensions.
 */
console.log(
  'MVC assessment script — placeholder. See docs/superpowers/specs/2026-06-10-mvc-assessment-script-design.md',
);
```

- [ ] **Step 5: Run the type test and confirm pass**

Run: `cd /home/steve/Development/storybook && yarn vitest run --project scripts scripts/sustainability/assess-mvc/types.test.ts`
Expected: PASS (5 it blocks).

- [ ] **Step 6: Smoke-test the entry**

Run: `cd /home/steve/Development/storybook && node scripts/sustainability/assess-mvc.ts`
Expected: prints the placeholder message; exits 0.

- [ ] **Step 7: Commit**

```bash
cd /home/steve/Development/storybook
yarn fmt:write
git add scripts/sustainability/
git commit -m "Bootstrap mvc-assess directory and core types"
```

### Task 1.2: GitHub client factory

**Files:**

- Create: `scripts/sustainability/assess-mvc/github/client.ts`
- Test: `scripts/sustainability/assess-mvc/github/client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/sustainability/assess-mvc/github/client.test.ts
import { describe, expect, it } from 'vitest';
import { createGithubClient, requireToken } from './client.ts';

describe('requireToken', () => {
  it('returns the token when present', () => {
    expect(requireToken({ GH_TOKEN: 'abc' })).toBe('abc');
    expect(requireToken({ GITHUB_TOKEN: 'def' })).toBe('def');
    expect(requireToken({ GH_TOKEN: 'abc', GITHUB_TOKEN: 'def' })).toBe('abc');
  });

  it('throws a usage error when neither var is set', () => {
    expect(() => requireToken({})).toThrowError(/GH_TOKEN|GITHUB_TOKEN/);
  });
});

describe('createGithubClient', () => {
  it('returns an object exposing graphql and rest with defaults applied', () => {
    const client = createGithubClient('abc123');
    expect(typeof client.graphql).toBe('function');
    expect(typeof client.rest).toBe('function');
    // Defaults survive on the returned client (no HTTP call).
    expect((client.rest as any).endpoint.DEFAULTS.headers.authorization).toBe('token abc123');
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `cd /home/steve/Development/storybook && yarn vitest run --project scripts scripts/sustainability/assess-mvc/github/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client factory**

```ts
// scripts/sustainability/assess-mvc/github/client.ts
import { graphql } from '@octokit/graphql';
import { request } from '@octokit/request';

const TOKEN_VARS = ['GH_TOKEN', 'GITHUB_TOKEN'] as const;

export function requireToken(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  for (const key of TOKEN_VARS) {
    const value = env[key];
    if (value && value.trim() !== '') return value;
  }
  throw new Error(
    'No GitHub token found. Set GH_TOKEN or GITHUB_TOKEN. Required scopes: pull_requests:read+write, issues:read+write, contents:read, members:read (org).',
  );
}

export interface GithubClient {
  graphql: typeof graphql;
  rest: typeof request;
}

export function createGithubClient(token: string): GithubClient {
  return {
    graphql: graphql.defaults({ headers: { authorization: `token ${token}` } }),
    rest: request.defaults({
      headers: {
        authorization: `token ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }),
  };
}
```

- [ ] **Step 4: Confirm pass**

Run: `cd /home/steve/Development/storybook && yarn vitest run --project scripts scripts/sustainability/assess-mvc/github/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/steve/Development/storybook
yarn fmt:write
git add scripts/sustainability/assess-mvc/github/
git commit -m "Add GitHub client factory and token requirement"
```

### Task 1.3: PR resolver (parse + fetch)

**Files:**

- Create: `scripts/sustainability/assess-mvc/github/pr.ts`
- Test: `scripts/sustainability/assess-mvc/github/pr.test.ts`

- [ ] **Step 1: Write failing tests for PR-arg parsing**

```ts
// scripts/sustainability/assess-mvc/github/pr.test.ts
import { describe, expect, it, vi } from 'vitest';
import { parsePrArg, fetchPr } from './pr.ts';

describe('parsePrArg', () => {
  it('accepts a bare number', () => {
    expect(parsePrArg('12345')).toEqual({ owner: 'storybookjs', repo: 'storybook', number: 12345 });
  });

  it('accepts a full GitHub URL on storybookjs/storybook', () => {
    expect(parsePrArg('https://github.com/storybookjs/storybook/pull/12345')).toEqual({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 12345,
    });
  });

  it('rejects URLs outside storybookjs', () => {
    expect(() => parsePrArg('https://github.com/example/other/pull/1')).toThrowError(/storybookjs/);
  });

  it('rejects garbage', () => {
    expect(() => parsePrArg('not-a-pr')).toThrowError(/PR/);
    expect(() => parsePrArg('')).toThrowError();
  });
});

describe('fetchPr', () => {
  it('returns a PrContext with files paginated', async () => {
    const calls: string[] = [];
    const client = {
      graphql: vi.fn(),
      rest: (async (route: string, _params: any) => {
        calls.push(route);
        if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') {
          return {
            data: {
              number: 1,
              title: 'fix x',
              body: 'closes #99',
              user: { login: 'someone' },
              draft: false,
              head: { sha: 'deadbeef' },
              labels: [{ name: 'bug' }],
              html_url: 'https://github.com/storybookjs/storybook/pull/1',
            },
          };
        }
        if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files') {
          return {
            data: [
              { filename: 'a.ts', additions: 3, deletions: 1, patch: '@@ ...', status: 'modified' },
            ],
          };
        }
        throw new Error(`unexpected ${route}`);
      }) as any,
    };
    const ctx = await fetchPr(client as any, {
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(ctx.title).toBe('fix x');
    expect(ctx.author).toBe('someone');
    expect(ctx.isDraft).toBe(false);
    expect(ctx.headSha).toBe('deadbeef');
    expect(ctx.labels).toEqual(['bug']);
    expect(ctx.files).toHaveLength(1);
    expect(ctx.files[0]).toMatchObject({ path: 'a.ts', additions: 3, deletions: 1 });
    expect(calls).toContain('GET /repos/{owner}/{repo}/pulls/{pull_number}/files');
  });
});
```

- [ ] **Step 2: Confirm failure** — `Module not found` for `./pr.ts`.

- [ ] **Step 3: Implement `pr.ts`**

```ts
// scripts/sustainability/assess-mvc/github/pr.ts
import { ORG, PRIMARY_REPO } from '../config.ts';
import type { GithubClient } from './client.ts';
import type { PrContext } from '../types.ts';

export interface PrCoords {
  owner: string;
  repo: string;
  number: number;
}

const URL_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;

export function parsePrArg(arg: string): PrCoords {
  const trimmed = (arg ?? '').trim();
  if (trimmed === '') throw new Error('PR argument required (number or URL).');
  if (/^\d+$/.test(trimmed)) {
    return { owner: ORG, repo: PRIMARY_REPO, number: Number(trimmed) };
  }
  const match = URL_RE.exec(trimmed);
  if (!match)
    throw new Error(`Could not parse PR from "${trimmed}". Expect a number or full PR URL.`);
  const [, owner, repo, number] = match;
  if (owner !== ORG) {
    throw new Error(`PR must be in the ${ORG} org; got ${owner}/${repo}.`);
  }
  return { owner, repo, number: Number(number) };
}

export async function fetchPr(
  client: GithubClient,
  coords: PrCoords,
): Promise<Omit<PrContext, 'linkedIssues' | 'brokenLinkRefs'>> {
  const { data: pr } = await client.rest('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner: coords.owner,
    repo: coords.repo,
    pull_number: coords.number,
  });

  const files: PrContext['files'] = [];
  let page = 1;
  while (true) {
    const { data } = await client.rest('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
      owner: coords.owner,
      repo: coords.repo,
      pull_number: coords.number,
      per_page: 100,
      page,
    });
    if (data.length === 0) break;
    for (const file of data) {
      files.push({
        path: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        status: file.status,
      });
    }
    if (data.length < 100) break;
    page += 1;
  }

  return {
    owner: coords.owner,
    repo: coords.repo,
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    body: pr.body ?? '',
    author: pr.user?.login ?? '',
    isDraft: Boolean(pr.draft),
    headSha: pr.head.sha,
    labels: (pr.labels ?? []).map((l: any) => l.name),
    files,
  };
}
```

- [ ] **Step 4: Confirm pass** — `yarn vitest run --project scripts scripts/sustainability/assess-mvc/github/pr.test.ts` passes.

- [ ] **Step 5: Commit**

```bash
git add scripts/sustainability/assess-mvc/github/pr.ts scripts/sustainability/assess-mvc/github/pr.test.ts
git commit -m "Add PR resolver: parse arg and fetch metadata + files"
```

### Task 1.4: Linked-issue resolution

**Files:**

- Create: `scripts/sustainability/assess-mvc/github/linked-issues.ts`
- Test: `scripts/sustainability/assess-mvc/github/linked-issues.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// scripts/sustainability/assess-mvc/github/linked-issues.test.ts
import { describe, expect, it, vi } from 'vitest';
import { parseBodyReferences, resolveLinkedIssues } from './linked-issues.ts';

describe('parseBodyReferences', () => {
  it('extracts same-repo #N references', () => {
    const refs = parseBodyReferences('storybookjs', 'storybook', 'Closes #42 and resolves #99.');
    expect(refs).toEqual([
      { owner: 'storybookjs', repo: 'storybook', number: 42 },
      { owner: 'storybookjs', repo: 'storybook', number: 99 },
    ]);
  });

  it('extracts cross-repo storybookjs/x#N references', () => {
    const refs = parseBodyReferences('storybookjs', 'storybook', 'Tracks storybookjs/csf#7.');
    expect(refs).toEqual([{ owner: 'storybookjs', repo: 'csf', number: 7 }]);
  });

  it('extracts full URLs', () => {
    const refs = parseBodyReferences(
      'storybookjs',
      'storybook',
      'See https://github.com/storybookjs/csf/issues/12.',
    );
    expect(refs).toEqual([{ owner: 'storybookjs', repo: 'csf', number: 12 }]);
  });

  it('ignores references outside storybookjs', () => {
    const refs = parseBodyReferences(
      'storybookjs',
      'storybook',
      'other/repo#1 https://github.com/example/x/issues/2',
    );
    expect(refs).toEqual([]);
  });

  it('dedupes', () => {
    const refs = parseBodyReferences('storybookjs', 'storybook', '#1 #1 storybookjs/storybook#1');
    expect(refs).toHaveLength(1);
  });
});

describe('resolveLinkedIssues', () => {
  it('combines GraphQL closing refs with body refs, resolves each, and tracks broken links', async () => {
    const graphql = vi.fn().mockResolvedValue({
      repository: {
        pullRequest: {
          closingIssuesReferences: {
            nodes: [
              { number: 42, repository: { owner: { login: 'storybookjs' }, name: 'storybook' } },
            ],
          },
        },
      },
    });
    const rest = vi.fn(async (route: string, params: any) => {
      if (params.issue_number === 42) {
        return {
          data: {
            number: 42,
            title: 'A',
            body: 'b',
            state: 'open',
            labels: [{ name: 'bug' }],
            html_url: 'u',
          },
        };
      }
      if (params.issue_number === 99) {
        // simulate 404
        const err: any = new Error('Not Found');
        err.status = 404;
        throw err;
      }
      throw new Error(`unexpected ${route}`);
    });
    const client = { graphql, rest } as any;
    const { issues, broken } = await resolveLinkedIssues(client, {
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
      body: 'closes #99',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 42,
      state: 'open',
    });
    expect(broken).toEqual(['storybookjs/storybook#99']);
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement linked-issues.ts**

```ts
// scripts/sustainability/assess-mvc/github/linked-issues.ts
import { ORG } from '../config.ts';
import type { GithubClient } from './client.ts';
import type { LinkedIssue } from '../types.ts';

export interface IssueRef {
  owner: string;
  repo: string;
  number: number;
}

const SAME_REPO_RE = /(?<![A-Za-z0-9_/-])#(\d+)\b/g;
const CROSS_REPO_RE = /\b(storybookjs)\/([A-Za-z0-9_.-]+)#(\d+)\b/g;
const URL_RE = /\bhttps:\/\/github\.com\/(storybookjs)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)\b/g;

export function parseBodyReferences(prOwner: string, prRepo: string, body: string): IssueRef[] {
  const refs: IssueRef[] = [];
  for (const m of body.matchAll(CROSS_REPO_RE)) {
    refs.push({ owner: m[1], repo: m[2], number: Number(m[3]) });
  }
  for (const m of body.matchAll(URL_RE)) {
    refs.push({ owner: m[1], repo: m[2], number: Number(m[3]) });
  }
  // Same-repo #N is only valid when the PR itself is in storybookjs/*.
  if (prOwner === ORG) {
    for (const m of body.matchAll(SAME_REPO_RE)) {
      refs.push({ owner: prOwner, repo: prRepo, number: Number(m[1]) });
    }
  }
  return dedupe(refs).filter((r) => r.owner === ORG);
}

function dedupe(refs: IssueRef[]): IssueRef[] {
  const seen = new Set<string>();
  const out: IssueRef[] = [];
  for (const r of refs) {
    const key = `${r.owner}/${r.repo}#${r.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

async function fetchClosingRefs(
  client: GithubClient,
  owner: string,
  repo: string,
  number: number,
): Promise<IssueRef[]> {
  const data = await client.graphql<any>(
    `query($owner:String!,$repo:String!,$num:Int!){
      repository(owner:$owner,name:$repo){
        pullRequest(number:$num){
          closingIssuesReferences(first:50){
            nodes{ number repository{ owner{login} name } }
          }
        }
      }
    }`,
    { owner, repo, num: number },
  );
  const nodes = data.repository?.pullRequest?.closingIssuesReferences?.nodes ?? [];
  return nodes.map((n: any) => ({
    owner: n.repository.owner.login,
    repo: n.repository.name,
    number: n.number,
  }));
}

export async function resolveLinkedIssues(
  client: GithubClient,
  pr: { owner: string; repo: string; number: number; body: string },
): Promise<{ issues: LinkedIssue[]; broken: string[] }> {
  const closing = await fetchClosingRefs(client, pr.owner, pr.repo, pr.number);
  const bodyRefs = parseBodyReferences(pr.owner, pr.repo, pr.body);
  const candidates = dedupe([...closing, ...bodyRefs]).filter((r) => r.owner === ORG);
  const issues: LinkedIssue[] = [];
  const broken: string[] = [];
  for (const ref of candidates) {
    try {
      const { data } = await client.rest('GET /repos/{owner}/{repo}/issues/{issue_number}', {
        owner: ref.owner,
        repo: ref.repo,
        issue_number: ref.number,
      });
      issues.push({
        owner: ref.owner,
        repo: ref.repo,
        number: ref.number,
        url: data.html_url,
        title: data.title,
        body: data.body ?? '',
        state: data.state === 'open' ? 'open' : 'closed',
        labels: (data.labels ?? []).map((l: any) => (typeof l === 'string' ? l : l.name)),
      });
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 410) {
        broken.push(`${ref.owner}/${ref.repo}#${ref.number}`);
      } else {
        throw err;
      }
    }
  }
  return { issues, broken };
}
```

- [ ] **Step 4: Confirm pass**.

- [ ] **Step 5: Commit**

```bash
git add scripts/sustainability/assess-mvc/github/linked-issues.ts scripts/sustainability/assess-mvc/github/linked-issues.test.ts
git commit -m "Resolve linked issues from GraphQL + PR body, track broken refs"
```

### Task 1.5: Precompute — diff metrics

**Files:**

- Create: `scripts/sustainability/assess-mvc/precomputes/diff-metrics.ts`
- Test: `scripts/sustainability/assess-mvc/precomputes/diff-metrics.test.ts`

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/precomputes/diff-metrics.test.ts
import { describe, expect, it } from 'vitest';
import { computeDiffMetrics } from './diff-metrics.ts';

describe('computeDiffMetrics', () => {
  it('sums additions/deletions and counts files', () => {
    const m = computeDiffMetrics([
      { path: 'a.ts', additions: 10, deletions: 2, status: 'modified' },
      { path: 'b.ts', additions: 5, deletions: 0, status: 'added' },
      { path: 'c.md', additions: 0, deletions: 3, status: 'removed' },
    ]);
    expect(m).toEqual({
      filesChanged: 3,
      added: 15,
      removed: 5,
      net: 10,
      files: ['a.ts', 'b.ts', 'c.md'],
    });
  });

  it('returns zeros for empty diff', () => {
    expect(computeDiffMetrics([])).toEqual({
      filesChanged: 0,
      added: 0,
      removed: 0,
      net: 0,
      files: [],
    });
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement**

```ts
// scripts/sustainability/assess-mvc/precomputes/diff-metrics.ts
import type { PrContext } from '../types.ts';

export interface DiffMetrics {
  filesChanged: number;
  added: number;
  removed: number;
  net: number;
  files: string[];
}

export function computeDiffMetrics(files: PrContext['files']): DiffMetrics {
  let added = 0;
  let removed = 0;
  for (const f of files) {
    added += f.additions;
    removed += f.deletions;
  }
  return {
    filesChanged: files.length,
    added,
    removed,
    net: added - removed,
    files: files.map((f) => f.path),
  };
}
```

- [ ] **Step 4: Confirm pass**.

- [ ] **Step 5: Commit**

```bash
git add scripts/sustainability/assess-mvc/precomputes/diff-metrics.ts scripts/sustainability/assess-mvc/precomputes/diff-metrics.test.ts
git commit -m "Add diff-metrics precompute (LOC and file counts)"
```

### Task 1.6: Precompute — dependencies

**Files:**

- Create: `scripts/sustainability/assess-mvc/precomputes/dependencies.ts`
- Test: `scripts/sustainability/assess-mvc/precomputes/dependencies.test.ts`

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/precomputes/dependencies.test.ts
import { describe, expect, it } from 'vitest';
import { computeAddedDependencies } from './dependencies.ts';

describe('computeAddedDependencies', () => {
  const samplePatch = `@@ -10,7 +10,8 @@
   "dependencies": {
-    "foo": "^1.0.0"
+    "foo": "^1.0.0",
+    "bar": "^2.1.3"
   },
   "peerDependencies": {
+    "baz": "^3.0.0"
   }`;

  it('extracts new runtime + peer deps from package.json patches', () => {
    const result = computeAddedDependencies([
      { path: 'package.json', additions: 2, deletions: 0, patch: samplePatch, status: 'modified' },
    ]);
    expect(result).toEqual({
      runtime: ['bar@^2.1.3'],
      peer: ['baz@^3.0.0'],
    });
  });

  it('ignores devDependencies', () => {
    const patch = `@@ -1,3 +1,5 @@
   "devDependencies": {
+    "vitest": "^1.0.0"
   }`;
    expect(
      computeAddedDependencies([
        { path: 'package.json', additions: 1, deletions: 0, patch, status: 'modified' },
      ]),
    ).toEqual({ runtime: [], peer: [] });
  });

  it('returns empty when no package.json changes', () => {
    expect(
      computeAddedDependencies([{ path: 'a.ts', additions: 1, deletions: 0, status: 'modified' }]),
    ).toEqual({ runtime: [], peer: [] });
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement**

```ts
// scripts/sustainability/assess-mvc/precomputes/dependencies.ts
import type { PrContext } from '../types.ts';

export interface AddedDeps {
  runtime: string[];
  peer: string[];
}

const ADDED_DEP_LINE = /^\+\s*"([^"]+)"\s*:\s*"([^"]+)"/;

type Section = 'none' | 'dependencies' | 'peerDependencies' | 'other';

export function computeAddedDependencies(files: PrContext['files']): AddedDeps {
  const result: AddedDeps = { runtime: [], peer: [] };
  for (const file of files) {
    if (file.path !== 'package.json' && !file.path.endsWith('/package.json')) continue;
    if (!file.patch) continue;
    let section: Section = 'none';
    for (const line of file.patch.split('\n')) {
      if (line.startsWith('@@')) {
        section = 'none';
        continue;
      }
      const trimmed = line.replace(/^[+\- ]/, '').trim();
      if (trimmed.includes('"dependencies"')) section = 'dependencies';
      else if (trimmed.includes('"peerDependencies"')) section = 'peerDependencies';
      else if (/^"[a-zA-Z]+Dependencies"\s*:/.test(trimmed)) section = 'other';

      if (section !== 'dependencies' && section !== 'peerDependencies') continue;
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      const match = ADDED_DEP_LINE.exec(line);
      if (!match) continue;
      const [, name, version] = match;
      const entry = `${name}@${version}`;
      if (section === 'dependencies') result.runtime.push(entry);
      else result.peer.push(entry);
    }
  }
  return result;
}
```

- [ ] **Step 4: Confirm pass**.

- [ ] **Step 5: Commit**

```bash
git add scripts/sustainability/assess-mvc/precomputes/dependencies.ts scripts/sustainability/assess-mvc/precomputes/dependencies.test.ts
git commit -m "Add dependencies precompute (parse package.json patch)"
```

### Task 1.7: Precompute — cyclomatic complexity

**Files:**

- Create: `scripts/sustainability/assess-mvc/precomputes/cyclomatic.ts`
- Test: `scripts/sustainability/assess-mvc/precomputes/cyclomatic.test.ts`

We use the TypeScript compiler API directly — a small walker that counts decision points per function. Reusing csf-tools is unnecessary; `typescript` is already in scripts deps. The walker analyses the file _at the PR's head SHA_, fetched via `GET /repos/{o}/{r}/contents/{path}?ref={sha}`. We test the walker on raw source strings (the fetch is exercised in the check that wires it in).

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/precomputes/cyclomatic.test.ts
import { describe, expect, it } from 'vitest';
import { complexityForSource } from './cyclomatic.ts';

describe('complexityForSource', () => {
  it('returns 1 for a function with no branches', () => {
    const src = `function a(){ return 1; }`;
    expect(complexityForSource('a.ts', src)).toEqual([{ name: 'a', complexity: 1 }]);
  });

  it('adds 1 per if/for/while/case/&&/||/?', () => {
    const src = `function f(x:number){
      if (x>0 && x<10) return 1;
      for (let i=0;i<x;i++){}
      switch(x){ case 1: case 2: return 2; default: return 3; }
      return x ? 1 : 0;
    }`;
    // baseline 1 + if 1 + && 1 + for 1 + case 2 + ternary 1 = 7
    expect(complexityForSource('f.ts', src)).toEqual([{ name: 'f', complexity: 7 }]);
  });

  it('finds arrow functions and methods', () => {
    const src = `
      export const g = (x:number)=> x>0 ? 1 : 0;
      class C { m(){ if(true){} } }
    `;
    const result = complexityForSource('f.ts', src).sort((a, b) => a.name.localeCompare(b.name));
    expect(result).toEqual([
      { name: 'C.m', complexity: 2 },
      { name: 'g', complexity: 2 },
    ]);
  });

  it('returns [] for non-JS/TS files', () => {
    expect(complexityForSource('readme.md', '# hi')).toEqual([]);
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement**

```ts
// scripts/sustainability/assess-mvc/precomputes/cyclomatic.ts
import ts from 'typescript';

export interface FunctionComplexity {
  name: string;
  complexity: number;
}

const SCRIPT_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export function complexityForSource(filename: string, source: string): FunctionComplexity[] {
  if (!SCRIPT_EXTS.some((ext) => filename.endsWith(ext))) return [];
  const sf = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.Latest,
  );
  const results: FunctionComplexity[] = [];

  const visitFunction = (node: ts.Node, name: string) => {
    let complexity = 1;
    const walk = (n: ts.Node) => {
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CatchClause:
          complexity += 1;
          break;
        case ts.SyntaxKind.BinaryExpression: {
          const op = (n as ts.BinaryExpression).operatorToken.kind;
          if (
            op === ts.SyntaxKind.AmpersandAmpersandToken ||
            op === ts.SyntaxKind.BarBarToken ||
            op === ts.SyntaxKind.QuestionQuestionToken
          ) {
            complexity += 1;
          }
          break;
        }
        default:
          break;
      }
      // Don't descend into nested functions — they're visited at the top level.
      if (
        n !== node &&
        (ts.isFunctionDeclaration(n) ||
          ts.isFunctionExpression(n) ||
          ts.isArrowFunction(n) ||
          ts.isMethodDeclaration(n))
      ) {
        return;
      }
      ts.forEachChild(n, walk);
    };
    walk(node);
    results.push({ name, complexity });
  };

  const nameOfFunctionLike = (node: ts.Node, parentName?: string): string | undefined => {
    if (ts.isFunctionDeclaration(node)) return node.name?.text;
    if (ts.isMethodDeclaration(node)) {
      const cls = findEnclosingClassName(node);
      const m =
        node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
          ? node.name.text
          : 'method';
      return cls ? `${cls}.${m}` : m;
    }
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      const parent = node.parent;
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
        return parent.name.text;
      if (
        parent &&
        ts.isPropertyAssignment(parent) &&
        (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))
      )
        return parent.name.text;
      return parentName;
    }
    return undefined;
  };

  const findEnclosingClassName = (node: ts.Node): string | undefined => {
    let cur: ts.Node | undefined = node.parent;
    while (cur) {
      if (ts.isClassDeclaration(cur) || ts.isClassExpression(cur)) return cur.name?.text ?? 'Anon';
      cur = cur.parent;
    }
    return undefined;
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      const name = nameOfFunctionLike(node) ?? '<anonymous>';
      visitFunction(node, name);
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return results;
}

export async function complexityForChangedFiles(
  fetchContents: (path: string, sha: string) => Promise<string | null>,
  files: Array<{ path: string; status: string }>,
  headSha: string,
): Promise<Array<{ path: string; functions: FunctionComplexity[] }>> {
  const out: Array<{ path: string; functions: FunctionComplexity[] }> = [];
  for (const f of files) {
    if (f.status === 'removed') continue;
    if (!SCRIPT_EXTS.some((ext) => f.path.endsWith(ext))) continue;
    const src = await fetchContents(f.path, headSha);
    if (src == null) continue;
    out.push({ path: f.path, functions: complexityForSource(f.path, src) });
  }
  return out;
}
```

- [ ] **Step 4: Confirm pass**.

- [ ] **Step 5: Commit**

```bash
git add scripts/sustainability/assess-mvc/precomputes/cyclomatic.ts scripts/sustainability/assess-mvc/precomputes/cyclomatic.test.ts
git commit -m "Add cyclomatic-complexity precompute via TS compiler API"
```

### Task 1.8: Check 1 — human-monitored

**Files:**

- Create: `scripts/sustainability/assess-mvc/checks/human-monitored.ts`
- Test: `scripts/sustainability/assess-mvc/checks/human-monitored.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// scripts/sustainability/assess-mvc/checks/human-monitored.test.ts
import { describe, expect, it } from 'vitest';
import { checkHumanMonitored } from './human-monitored.ts';

describe('checkHumanMonitored', () => {
  it('PASS when agent-scan:human is present', () => {
    expect(checkHumanMonitored(['bug', 'agent-scan:human'])).toMatchObject({
      id: 'human',
      status: 'pass',
    });
  });

  it.each(['agent-scan:mixed', 'agent-scan:automated'])('FAILs on %s', (label) => {
    const r = checkHumanMonitored([label]);
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain(label);
  });

  it('DEFERS when no agent-scan label is present', () => {
    expect(checkHumanMonitored(['bug']).status).toBe('deferred');
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement**

```ts
// scripts/sustainability/assess-mvc/checks/human-monitored.ts
import type { CheckResult } from '../types.ts';

const PASS_LABEL = 'agent-scan:human';
const FAIL_LABELS = new Set(['agent-scan:mixed', 'agent-scan:automated']);

export function checkHumanMonitored(labels: string[]): CheckResult {
  if (labels.includes(PASS_LABEL)) {
    return { id: 'human', status: 'pass', evidence: PASS_LABEL };
  }
  const failHit = labels.find((l) => FAIL_LABELS.has(l));
  if (failHit) {
    return {
      id: 'human',
      status: 'fail',
      evidence: `Labeled ${failHit}; this assessment is reserved for human-authored contributions.`,
      guidance:
        'This PR is flagged as authored or co-authored by an automated agent. We only accept PRs from human contributors.',
    };
  }
  return {
    id: 'human',
    status: 'deferred',
    evidence: 'No agent-scan:* label yet; deferring until scan runs.',
  };
}
```

- [ ] **Step 4: Confirm pass**.

- [ ] **Step 5: Commit**

```bash
git add scripts/sustainability/assess-mvc/checks/human-monitored.ts scripts/sustainability/assess-mvc/checks/human-monitored.test.ts
git commit -m "Add Check 1 (human-monitored) with defer support"
```

### Task 1.9: Check 3 — duplicate

**Files:**

- Create: `scripts/sustainability/assess-mvc/checks/duplicate.ts`
- Test: `scripts/sustainability/assess-mvc/checks/duplicate.test.ts`

Duplicate detection walks each linked issue's cross-references and timeline. Wrapped behind a `DuplicateSource` interface so tests inject fake data.

- [ ] **Step 1: Failing tests**

```ts
// scripts/sustainability/assess-mvc/checks/duplicate.test.ts
import { describe, expect, it } from 'vitest';
import { checkDuplicate, type CrossRefEvent, type TimelineEvent } from './duplicate.ts';

const issue = {
  owner: 'storybookjs',
  repo: 'storybook',
  number: 100,
  state: 'open' as const,
  url: 'u',
};

const make =
  (crossRefs: CrossRefEvent[], timeline: TimelineEvent[] = []) =>
  async () => ({ crossRefs, timeline });

describe('checkDuplicate', () => {
  it('PASS when no other PRs reference any linked issue', async () => {
    const r = await checkDuplicate(123, [issue], make([]));
    expect(r.status).toBe('pass');
  });

  it('FAIL when another open PR references the same issue', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make([{ prNumber: 456, prState: 'open', merged: false }]),
    );
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#456');
  });

  it('FAIL when another merged PR references the issue and issue was never reopened', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make([{ prNumber: 789, prState: 'closed', merged: true }], []),
    );
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#789');
  });

  it('PASS when prior merged PR exists and the issue was closed-then-reopened', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make(
        [{ prNumber: 789, prState: 'closed', merged: true }],
        [
          { type: 'closed', at: '2025-01-01' },
          { type: 'reopened', at: '2025-02-01' },
        ],
      ),
    );
    expect(r.status).toBe('pass');
  });

  it('PASS (silent) when only closed-unmerged PRs reference the issue', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make([{ prNumber: 555, prState: 'closed', merged: false }]),
    );
    expect(r.status).toBe('pass');
  });

  it('excludes the PR-under-review from candidates', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make([{ prNumber: 123, prState: 'open', merged: false }]),
    );
    expect(r.status).toBe('pass');
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement**

```ts
// scripts/sustainability/assess-mvc/checks/duplicate.ts
import type { CheckResult, LinkedIssue } from '../types.ts';

export interface CrossRefEvent {
  prNumber: number;
  prState: 'open' | 'closed';
  merged: boolean;
}

export interface TimelineEvent {
  type: 'closed' | 'reopened' | string;
  at: string;
}

export type DuplicateLookup = (issue: Pick<LinkedIssue, 'owner' | 'repo' | 'number'>) => Promise<{
  crossRefs: CrossRefEvent[];
  timeline: TimelineEvent[];
}>;

export async function checkDuplicate(
  selfPrNumber: number,
  linkedIssues: Array<Pick<LinkedIssue, 'owner' | 'repo' | 'number' | 'state' | 'url'>>,
  lookup: DuplicateLookup,
): Promise<CheckResult> {
  if (linkedIssues.length === 0) {
    return {
      id: 'duplicate',
      status: 'pass',
      evidence: 'No linked issues; duplicate check is moot.',
    };
  }

  const conflicts: string[] = [];
  for (const issue of linkedIssues) {
    const { crossRefs, timeline } = await lookup(issue);
    const wasReopened = isClosedThenReopened(timeline);
    for (const ref of crossRefs) {
      if (ref.prNumber === selfPrNumber) continue;
      if (ref.prState === 'open' && !ref.merged) {
        conflicts.push(
          `#${ref.prNumber} (open) references the same issue ${issue.owner}/${issue.repo}#${issue.number}`,
        );
      } else if (ref.merged && !wasReopened) {
        conflicts.push(
          `#${ref.prNumber} (merged) already fixed ${issue.owner}/${issue.repo}#${issue.number}`,
        );
      }
      // closed-unmerged or merged+reopened: not a conflict.
    }
  }

  if (conflicts.length > 0) {
    return {
      id: 'duplicate',
      status: 'fail',
      evidence: conflicts.join('; '),
      guidance:
        'Another PR is already addressing this issue. Consider commenting on / contributing to that PR instead.',
    };
  }

  return {
    id: 'duplicate',
    status: 'pass',
    evidence: 'No conflicting PRs found on the linked issue(s).',
  };
}

function isClosedThenReopened(timeline: TimelineEvent[]): boolean {
  let sawClosed = false;
  for (const event of timeline) {
    if (event.type === 'closed') sawClosed = true;
    if (event.type === 'reopened' && sawClosed) return true;
  }
  return false;
}
```

- [ ] **Step 4: Add a thin lookup factory using GitHub APIs (no test — covered in CLI integration)**

```ts
// append to scripts/sustainability/assess-mvc/checks/duplicate.ts
import type { GithubClient } from '../github/client.ts';

export function githubDuplicateLookup(client: GithubClient): DuplicateLookup {
  return async (issue) => {
    const data = await client.graphql<any>(
      `query($owner:String!,$repo:String!,$num:Int!){
        repository(owner:$owner,name:$repo){
          issue(number:$num){
            timelineItems(first:100, itemTypes:[CROSS_REFERENCED_EVENT]){
              nodes{ ... on CrossReferencedEvent { source { ... on PullRequest { number state merged } } } }
            }
          }
        }
      }`,
      { owner: issue.owner, repo: issue.repo, num: issue.number },
    );
    const nodes = data.repository?.issue?.timelineItems?.nodes ?? [];
    const crossRefs: CrossRefEvent[] = [];
    for (const node of nodes) {
      const src = node?.source;
      if (!src || typeof src.number !== 'number') continue;
      crossRefs.push({
        prNumber: src.number,
        prState: src.state === 'OPEN' ? 'open' : 'closed',
        merged: Boolean(src.merged),
      });
    }
    const { data: timeline } = await client.rest(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline',
      {
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        per_page: 100,
      },
    );
    const timelineEvents: TimelineEvent[] = (timeline as any[]).map((e: any) => ({
      type: e.event,
      at: e.created_at,
    }));
    return { crossRefs, timeline: timelineEvents };
  };
}
```

- [ ] **Step 5: Confirm tests pass**.

- [ ] **Step 6: Commit**

```bash
git add scripts/sustainability/assess-mvc/checks/duplicate.ts scripts/sustainability/assess-mvc/checks/duplicate.test.ts
git commit -m "Add Check 3 (duplicate) with closed-then-reopened detection"
```

### Task 1.10: Skip-rules helper

**Files:**

- Create: `scripts/sustainability/assess-mvc/skip-rules.ts`
- Test: `scripts/sustainability/assess-mvc/skip-rules.test.ts`
- Create: `scripts/sustainability/assess-mvc/github/teams.ts`

- [ ] **Step 1: Failing tests**

```ts
// scripts/sustainability/assess-mvc/skip-rules.test.ts
import { describe, expect, it, vi } from 'vitest';
import { evaluateSkip } from './skip-rules.ts';

const baseCtx = {
  isDraft: false,
  labels: [] as string[],
  author: 'someone',
};

describe('evaluateSkip', () => {
  it('skips drafts', async () => {
    const r = await evaluateSkip(
      { ...baseCtx, isDraft: true },
      { isMaintainer: async () => false },
    );
    expect(r).toMatchObject({ skip: true, reason: 'draft' });
  });

  it('skips already-verdict-labeled PRs', async () => {
    expect(
      (
        await evaluateSkip(
          { ...baseCtx, labels: ['mvc:success'] },
          { isMaintainer: async () => false },
        )
      ).reason,
    ).toBe('already-assessed');
    expect(
      (
        await evaluateSkip(
          { ...baseCtx, labels: ['mvc:failed'] },
          { isMaintainer: async () => false },
        )
      ).reason,
    ).toBe('already-assessed');
  });

  it('skips mvc:skip', async () => {
    expect(
      (
        await evaluateSkip(
          { ...baseCtx, labels: ['mvc:skip'] },
          { isMaintainer: async () => false },
        )
      ).reason,
    ).toBe('explicit-skip');
  });

  it('skips maintainer-authored PRs', async () => {
    const r = await evaluateSkip(baseCtx, { isMaintainer: async () => true });
    expect(r).toMatchObject({ skip: true, reason: 'maintainer' });
  });

  it('does not skip otherwise', async () => {
    const r = await evaluateSkip(baseCtx, { isMaintainer: async () => false });
    expect(r.skip).toBe(false);
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement teams.ts**

```ts
// scripts/sustainability/assess-mvc/github/teams.ts
import { ORG, MAINTAINER_TEAM_SLUGS } from '../config.ts';
import type { GithubClient } from './client.ts';

export interface TeamMembership {
  isMaintainer(login: string): Promise<boolean>;
}

export function githubTeamMembership(client: GithubClient): TeamMembership {
  return {
    async isMaintainer(login) {
      if (!login) return false;
      for (const team of MAINTAINER_TEAM_SLUGS) {
        try {
          const { data } = await client.rest(
            'GET /orgs/{org}/teams/{team_slug}/memberships/{username}',
            {
              org: ORG,
              team_slug: team,
              username: login,
            },
          );
          if (data?.state === 'active') return true;
        } catch (err: any) {
          if (err?.status === 404) continue;
          throw err;
        }
      }
      return false;
    },
  };
}
```

- [ ] **Step 4: Implement skip-rules.ts**

```ts
// scripts/sustainability/assess-mvc/skip-rules.ts
import { SKIP_LABELS } from './config.ts';

export type SkipReason = 'draft' | 'already-assessed' | 'explicit-skip' | 'maintainer';

export interface SkipDecision {
  skip: boolean;
  reason?: SkipReason;
}

export interface SkipDeps {
  isMaintainer(login: string): Promise<boolean>;
}

export async function evaluateSkip(
  pr: { isDraft: boolean; labels: string[]; author: string },
  deps: SkipDeps,
): Promise<SkipDecision> {
  if (pr.isDraft) return { skip: true, reason: 'draft' };
  if (pr.labels.includes('mvc:success') || pr.labels.includes('mvc:failed')) {
    return { skip: true, reason: 'already-assessed' };
  }
  if (pr.labels.includes('mvc:skip')) return { skip: true, reason: 'explicit-skip' };
  if (await deps.isMaintainer(pr.author)) return { skip: true, reason: 'maintainer' };
  return { skip: false };
}
```

- [ ] **Step 5: Confirm pass**.

- [ ] **Step 6: Commit**

```bash
git add scripts/sustainability/assess-mvc/skip-rules.ts scripts/sustainability/assess-mvc/skip-rules.test.ts scripts/sustainability/assess-mvc/github/teams.ts
git commit -m "Add skip-rules and maintainer-team membership"
```

### Task 1.11: Verdict + output renderer

**Files:**

- Create: `scripts/sustainability/assess-mvc/verdict.ts`
- Create: `scripts/sustainability/assess-mvc/output.ts`
- Test: `scripts/sustainability/assess-mvc/verdict.test.ts`
- Test: `scripts/sustainability/assess-mvc/output.test.ts`

- [ ] **Step 1: Failing tests for verdict**

```ts
// scripts/sustainability/assess-mvc/verdict.test.ts
import { describe, expect, it } from 'vitest';
import { computeVerdict, isEarlyAbort } from './verdict.ts';
import type { CheckResult } from './types.ts';

const r = (id: CheckResult['id'], status: CheckResult['status']): CheckResult => ({
  id,
  status,
  evidence: '',
});

describe('computeVerdict', () => {
  it('FAIL when any check fails', () => {
    expect(computeVerdict([r('human', 'pass'), r('duplicate', 'fail')])).toBe('fail');
  });
  it('PASS when all are pass/warn/deferred', () => {
    expect(
      computeVerdict([
        r('human', 'pass'),
        r('cost-benefit', 'warn'),
        r('real-problem', 'deferred'),
      ]),
    ).toBe('pass');
  });
});

describe('isEarlyAbort', () => {
  it('true if any deterministic check failed', () => {
    expect(isEarlyAbort([r('human', 'fail'), r('duplicate', 'pass')])).toBe(true);
    expect(isEarlyAbort([r('human', 'pass'), r('duplicate', 'fail')])).toBe(true);
  });
  it('false otherwise', () => {
    expect(isEarlyAbort([r('human', 'pass'), r('duplicate', 'pass')])).toBe(false);
    expect(isEarlyAbort([r('human', 'deferred'), r('duplicate', 'pass')])).toBe(false);
  });
});
```

- [ ] **Step 2: Implement verdict.ts**

```ts
// scripts/sustainability/assess-mvc/verdict.ts
import type { CheckResult, Verdict } from './types.ts';

export function computeVerdict(results: CheckResult[]): Verdict {
  return results.some((r) => r.status === 'fail') ? 'fail' : 'pass';
}

const DETERMINISTIC_IDS: ReadonlyArray<CheckResult['id']> = ['human', 'duplicate'];

export function isEarlyAbort(results: CheckResult[]): boolean {
  return results.some((r) => DETERMINISTIC_IDS.includes(r.id) && r.status === 'fail');
}
```

- [ ] **Step 3: Failing test for output renderer**

```ts
// scripts/sustainability/assess-mvc/output.test.ts
import { describe, expect, it } from 'vitest';
import { renderSummary } from './output.ts';

describe('renderSummary', () => {
  it('renders a header line and a row per check id', () => {
    const out = renderSummary({
      pr: { number: 12345, title: 'Fix vite externals', author: 'someone', url: 'u' },
      verdict: 'fail',
      results: [
        { id: 'human', status: 'pass', evidence: 'agent-scan:human' },
        { id: 'real-problem', status: 'deferred', evidence: 'LLM phase not run' },
        { id: 'duplicate', status: 'pass', evidence: 'no conflicts' },
        { id: 'cost-benefit', status: 'warn', evidence: '+482 LOC' },
        { id: 'explains-test', status: 'fail', evidence: 'empty section' },
        { id: 'provides-context', status: 'pass', evidence: 'substantive' },
      ],
      reviewBody: 'BODY',
      labelsToAdd: ['mvc:failed'],
      labelsToRemove: ['mvc:skip'],
      dryRun: true,
    });
    expect(out).toContain('#12345');
    expect(out).toContain('FAIL');
    expect(out).toContain('Human-monitored');
    expect(out).toContain('Real problem');
    expect(out).toContain('Not duplicate');
    expect(out).toContain('Cost/benefit');
    expect(out).toContain('Explains how to test');
    expect(out).toContain('Provides context');
    expect(out).toContain('BODY');
    expect(out).toContain('add:    mvc:failed');
    expect(out).toContain('remove: mvc:skip');
  });
});
```

- [ ] **Step 4: Implement output.ts**

```ts
// scripts/sustainability/assess-mvc/output.ts
import pc from 'picocolors';
import type { CheckResult, Verdict } from './types.ts';

const LABELS: Record<CheckResult['id'], string> = {
  human: 'Human-monitored',
  'real-problem': 'Real problem',
  duplicate: 'Not duplicate',
  'cost-benefit': 'Cost/benefit',
  'explains-test': 'Explains how to test',
  'provides-context': 'Provides context',
};

const STATUS_COLOR: Record<CheckResult['status'], (s: string) => string> = {
  pass: pc.green,
  fail: pc.red,
  warn: pc.yellow,
  deferred: pc.dim,
};

export interface SummaryInput {
  pr: { number: number; title: string; author: string; url: string };
  verdict: Verdict;
  results: CheckResult[];
  reviewBody: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
  dryRun: boolean;
}

const CHECK_ORDER: CheckResult['id'][] = [
  'human',
  'real-problem',
  'duplicate',
  'cost-benefit',
  'explains-test',
  'provides-context',
];

export function renderSummary(input: SummaryInput): string {
  const { pr, verdict, results, reviewBody, labelsToAdd, labelsToRemove, dryRun } = input;
  const verdictText = verdict === 'pass' ? pc.green('PASS') : pc.red('FAIL');
  const lines: string[] = [];
  lines.push(`${pc.bold(`MVC Assessment — #${pr.number} "${pr.title}"`)}`);
  lines.push(`Author: @${pr.author}  |  Verdict: ${verdictText}`);
  lines.push('');
  lines.push(
    '| Criterion              | Status   | Evidence                                              |',
  );
  lines.push(
    '|------------------------|----------|-------------------------------------------------------|',
  );
  const byId = new Map(results.map((r) => [r.id, r] as const));
  for (const id of CHECK_ORDER) {
    const result = byId.get(id);
    if (!result) continue;
    const label = LABELS[id].padEnd(22);
    const status = STATUS_COLOR[result.status](result.status.toUpperCase().padEnd(8));
    const evidence = truncate(result.evidence, 53).padEnd(53);
    lines.push(`| ${label} | ${status} | ${evidence} |`);
  }
  lines.push('');
  lines.push(dryRun ? pc.cyan('[dry-run] Review:') : pc.cyan('Review submitted:'));
  lines.push('─────────────────────────────────────');
  lines.push(reviewBody);
  lines.push('─────────────────────────────────────');
  lines.push('');
  lines.push(dryRun ? pc.cyan('[dry-run] Labels:') : pc.cyan('Labels applied:'));
  for (const l of labelsToRemove) lines.push(`  remove: ${l}`);
  for (const l of labelsToAdd) lines.push(`  add:    ${l}`);
  return lines.join('\n');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
```

- [ ] **Step 5: Confirm both tests pass**.

- [ ] **Step 6: Commit**

```bash
git add scripts/sustainability/assess-mvc/verdict.ts scripts/sustainability/assess-mvc/verdict.test.ts scripts/sustainability/assess-mvc/output.ts scripts/sustainability/assess-mvc/output.test.ts
git commit -m "Add verdict logic and output renderer"
```

### Task 1.12: CLI assembly (deterministic only, dry-run-only)

**Files:**

- Modify: `scripts/sustainability/assess-mvc.ts`
- Modify: `scripts/package.json` (add `"mvc:assess": "node ./sustainability/assess-mvc.ts"` script entry)
- Test: `scripts/sustainability/assess-mvc.test.ts` (integration with all-fake clients)

- [ ] **Step 1: Failing integration test**

```ts
// scripts/sustainability/assess-mvc.test.ts
import { describe, expect, it } from 'vitest';
import { runAssessment } from './assess-mvc.ts';

const fakePr = {
  owner: 'storybookjs',
  repo: 'storybook',
  number: 1,
  url: 'u',
  title: 't',
  body: 'closes #2',
  author: 'someone',
  isDraft: false,
  headSha: 'sha',
  labels: ['agent-scan:human'],
  files: [],
};

const fakeIssue = {
  owner: 'storybookjs',
  repo: 'storybook',
  number: 2,
  url: 'u2',
  title: 'I',
  body: '',
  state: 'open' as const,
  labels: [],
};

describe('runAssessment (deterministic-only)', () => {
  it('PASSes deterministic phase, defers LLM checks, dry-run produces no writes', async () => {
    const writes: any[] = [];
    const result = await runAssessment({
      coords: { owner: 'storybookjs', repo: 'storybook', number: 1 },
      flags: {
        dryRun: true,
        dismissPrevious: false,
        respectSkipRules: false,
        model: 'sonnet-4.6',
        effort: 'medium',
        verbose: false,
      },
      deps: {
        fetchPrContext: async () => ({ ...fakePr, linkedIssues: [fakeIssue], brokenLinkRefs: [] }),
        duplicateLookup: async () => ({ crossRefs: [], timeline: [] }),
        isMaintainer: async () => false,
        llmJudge: async (id) => ({
          id,
          status: 'deferred',
          evidence: 'LLM phase not wired in Phase 1',
        }),
        synthesizeReview: async () => 'placeholder review body',
        writes: {
          addLabels: async (l) => writes.push({ kind: 'add', l }),
          removeLabels: async (l) => writes.push({ kind: 'remove', l }),
          submitReview: async (r) => writes.push({ kind: 'review', r }),
          dismissPriorReviews: async () => writes.push({ kind: 'dismiss' }),
        },
      },
    });
    expect(result.verdict).toBe('pass');
    expect(writes).toEqual([]); // dry-run: nothing applied
    expect(result.labelsToAdd).toContain('mvc:success');
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement `assess-mvc.ts` orchestrator and CLI**

```ts
// scripts/sustainability/assess-mvc.ts
/**
 * MVC Assessment CLI.
 *
 * Usage: node scripts/sustainability/assess-mvc.ts <pr> [options]
 * See `docs/superpowers/specs/2026-06-10-mvc-assessment-script-design.md` for the full design.
 */
import { Command, Option } from 'commander';
import pc from 'picocolors';
import { createGithubClient, requireToken, type GithubClient } from './assess-mvc/github/client.ts';
import { parsePrArg, fetchPr } from './assess-mvc/github/pr.ts';
import { resolveLinkedIssues } from './assess-mvc/github/linked-issues.ts';
import { githubDuplicateLookup } from './assess-mvc/checks/duplicate.ts';
import { githubTeamMembership } from './assess-mvc/github/teams.ts';
import { evaluateSkip } from './assess-mvc/skip-rules.ts';
import { checkHumanMonitored } from './assess-mvc/checks/human-monitored.ts';
import { checkDuplicate } from './assess-mvc/checks/duplicate.ts';
import { computeVerdict, isEarlyAbort } from './assess-mvc/verdict.ts';
import { renderSummary } from './assess-mvc/output.ts';
import { VERDICT_LABELS, MANAGED_LABELS } from './assess-mvc/config.ts';
import type { CheckId, CheckResult, PrContext } from './assess-mvc/types.ts';

export type Model = 'sonnet-4.6' | 'opus-4.6' | 'haiku-4.5';
export type Effort = 'low' | 'medium' | 'high' | 'max';

export interface Flags {
  dryRun: boolean;
  dismissPrevious: boolean;
  respectSkipRules: boolean;
  model: Model;
  effort: Effort;
  verbose: boolean;
}

export interface AssessDeps {
  fetchPrContext(coords: { owner: string; repo: string; number: number }): Promise<PrContext>;
  duplicateLookup: (issue: { owner: string; repo: string; number: number }) => Promise<{
    crossRefs: any[];
    timeline: any[];
  }>;
  isMaintainer(login: string): Promise<boolean>;
  llmJudge(id: CheckId, ctx: PrContext): Promise<CheckResult>;
  synthesizeReview(input: {
    pr: PrContext;
    results: CheckResult[];
    earlyAbort: boolean;
  }): Promise<string>;
  writes: {
    addLabels(labels: string[]): Promise<void>;
    removeLabels(labels: string[]): Promise<void>;
    submitReview(input: { event: 'COMMENT' | 'REQUEST_CHANGES'; body: string }): Promise<void>;
    dismissPriorReviews(): Promise<void>;
  };
}

export interface RunInput {
  coords: { owner: string; repo: string; number: number };
  flags: Flags;
  deps: AssessDeps;
}

export interface RunResult {
  verdict: 'pass' | 'fail';
  results: CheckResult[];
  earlyAbort: boolean;
  reviewBody: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
}

export async function runAssessment(input: RunInput): Promise<RunResult> {
  const ctx = await input.deps.fetchPrContext(input.coords);

  // Deterministic phase.
  const det: CheckResult[] = [];
  det.push(checkHumanMonitored(ctx.labels));
  det.push(await checkDuplicate(ctx.number, ctx.linkedIssues, input.deps.duplicateLookup));

  const earlyAbort = isEarlyAbort(det);

  // LLM phase (Phase 2 wires real judgments; Phase 1 receives `deferred` from the fake).
  const llmIds: CheckId[] = ['real-problem', 'cost-benefit', 'explains-test', 'provides-context'];
  const llm: CheckResult[] = earlyAbort
    ? llmIds.map((id) => ({
        id,
        status: 'deferred' as const,
        evidence: 'Skipped due to early-abort.',
      }))
    : await Promise.all(llmIds.map((id) => input.deps.llmJudge(id, ctx)));

  const results: CheckResult[] = [...det, ...llm];
  const verdict = computeVerdict(results);
  const reviewBody = await input.deps.synthesizeReview({ pr: ctx, results, earlyAbort });
  const { labelsToAdd, labelsToRemove } = diffLabels(ctx.labels, verdict);

  if (!input.flags.dryRun) {
    if (input.flags.dismissPrevious) await input.deps.writes.dismissPriorReviews();
    if (labelsToRemove.length > 0) await input.deps.writes.removeLabels(labelsToRemove);
    if (labelsToAdd.length > 0) await input.deps.writes.addLabels(labelsToAdd);
    await input.deps.writes.submitReview({
      event: verdict === 'fail' ? 'REQUEST_CHANGES' : 'COMMENT',
      body: reviewBody,
    });
  }

  return { verdict, results, earlyAbort, reviewBody, labelsToAdd, labelsToRemove };
}

function diffLabels(
  current: string[],
  verdict: 'pass' | 'fail',
): { labelsToAdd: string[]; labelsToRemove: string[] } {
  const target = verdict === 'pass' ? VERDICT_LABELS.pass : VERDICT_LABELS.fail;
  const labelsToAdd = current.includes(target) ? [] : [target];
  const labelsToRemove = current.filter(
    (l) => (MANAGED_LABELS as readonly string[]).includes(l) && l !== target,
  );
  return { labelsToAdd, labelsToRemove };
}

async function main() {
  const program = new Command();
  program
    .name('assess-mvc')
    .description('Assess a Storybook PR against the six MVC criteria.')
    .argument('<pr>', 'PR number or GitHub URL')
    .option('--dry-run', 'Print what would happen; never modify GitHub (default).', true)
    .option('--no-dry-run', 'Apply changes (labels + review).')
    .option('--dismiss-previous', 'Dismiss prior bot reviews before posting.', false)
    .option('--no-dismiss-previous', 'Do not dismiss prior bot reviews (default).')
    .option('--respect-skip-rules', 'Skip ineligible PRs (drafts, maintainers, …).', false)
    .option('--no-respect-skip-rules', 'Always assess (default).')
    .addOption(
      new Option('--model <name>', 'Claude model')
        .choices(['sonnet-4.6', 'opus-4.6', 'haiku-4.5'])
        .default('sonnet-4.6'),
    )
    .addOption(
      new Option('--effort <level>', 'Reasoning effort')
        .choices(['low', 'medium', 'high', 'max'])
        .default('medium'),
    )
    .option('-v, --verbose', 'Print LLM input/output for debugging.', false);

  program.parse();
  const arg = program.args[0];
  const opts = program.opts<{
    dryRun: boolean;
    dismissPrevious: boolean;
    respectSkipRules: boolean;
    model: Model;
    effort: Effort;
    verbose: boolean;
  }>();

  let coords;
  try {
    coords = parsePrArg(arg);
  } catch (err: any) {
    console.error(pc.red(err.message));
    process.exit(1);
  }

  const token = (() => {
    try {
      return requireToken();
    } catch (err: any) {
      console.error(pc.red(err.message));
      process.exit(1);
    }
  })();

  const client = createGithubClient(token);
  const flags: Flags = {
    dryRun: opts.dryRun,
    dismissPrevious: opts.dismissPrevious,
    respectSkipRules: opts.respectSkipRules,
    model: opts.model,
    effort: opts.effort,
    verbose: opts.verbose,
  };

  const deps = buildDeps(client, flags);

  // Skip evaluation (only when --respect-skip-rules).
  if (flags.respectSkipRules) {
    const partial = await fetchPr(client, coords);
    const decision = await evaluateSkip(partial, {
      isMaintainer: githubTeamMembership(client).isMaintainer,
    });
    if (decision.skip) {
      console.log(pc.dim(`Skipped: ${decision.reason}`));
      process.exit(0);
    }
  }

  const result = await runAssessment({ coords, flags, deps });

  // Defer special-case: Check 1 deferred → exit 0, no review, no labels.
  const humanResult = result.results.find((r) => r.id === 'human');
  if (humanResult?.status === 'deferred') {
    console.log(pc.dim(`Deferred: ${humanResult.evidence}`));
    process.exit(0);
  }

  const partial = await deps.fetchPrContext(coords);
  console.log(
    renderSummary({
      pr: {
        number: partial.number,
        title: partial.title,
        author: partial.author,
        url: partial.url,
      },
      verdict: result.verdict,
      results: result.results,
      reviewBody: result.reviewBody,
      labelsToAdd: result.labelsToAdd,
      labelsToRemove: result.labelsToRemove,
      dryRun: flags.dryRun,
    }),
  );
}

function buildDeps(client: GithubClient, _flags: Flags): AssessDeps {
  return {
    async fetchPrContext(coords) {
      const partial = await fetchPr(client, coords);
      const { issues, broken } = await resolveLinkedIssues(client, {
        owner: coords.owner,
        repo: coords.repo,
        number: coords.number,
        body: partial.body,
      });
      return { ...partial, linkedIssues: issues, brokenLinkRefs: broken };
    },
    duplicateLookup: githubDuplicateLookup(client),
    isMaintainer: githubTeamMembership(client).isMaintainer,
    // Phase 1 stubs — replaced in Phase 2.
    async llmJudge(id) {
      return { id, status: 'deferred', evidence: 'LLM phase not yet wired (Phase 2).' };
    },
    async synthesizeReview({ results, earlyAbort }) {
      const lines = [
        '<!-- mvc-check:v1 -->',
        '## MVC Assessment',
        earlyAbort ? '> Early-abort: deterministic checks gated the LLM phase.' : '',
        '',
        ...results.map((r) => `- **${r.id}** — ${r.status.toUpperCase()}: ${r.evidence}`),
      ].filter(Boolean);
      return lines.join('\n');
    },
    writes: {
      async addLabels() {},
      async removeLabels() {},
      async submitReview() {},
      async dismissPriorReviews() {},
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(pc.red(err.stack ?? err.message));
    process.exit(2);
  });
}
```

- [ ] **Step 4: Confirm tests pass**

Run: `cd /home/steve/Development/storybook && yarn vitest run --project scripts scripts/sustainability/assess-mvc.test.ts`
Expected: PASS.

- [ ] **Step 5: Smoke-test CLI** (manual; expect 401 if no token, or a dry-run summary if one is set)

```bash
cd /home/steve/Development/storybook
node scripts/sustainability/assess-mvc.ts --help
# With a real token + real PR:
# GH_TOKEN=$(gh auth token) node scripts/sustainability/assess-mvc.ts 33524
```

- [ ] **Step 6: Add the script entry to scripts/package.json**

Edit `scripts/package.json` and add inside `"scripts"`:

```json
"mvc:assess": "node ./sustainability/assess-mvc.ts",
```

- [ ] **Step 7: Commit**

```bash
yarn fmt:write
git add scripts/sustainability/assess-mvc.ts scripts/sustainability/assess-mvc.test.ts scripts/package.json
git commit -m "Assemble assess-mvc CLI with deterministic-only orchestrator"
```

**Phase 1 checkpoint:** Tag this commit with `phase-1` locally (`git tag phase-1`). The CLI can now run end-to-end on a real PR; LLM checks return `deferred`. A real run produces a dry-run summary table and a placeholder review body. This is the right moment for the user to review the foundation before LLM integration.

---

## Phase 2 — LLM Checks

**Phase goal:** Wire all four LLM-judged checks + synthesis. Real assessment quality. Still dry-run only by default. After this phase the script could produce shareable assessments for spot-checking.

### Task 2.1: LLM client wrapper

**Files:**

- Create: `scripts/sustainability/assess-mvc/llm/client.ts`
- Test: `scripts/sustainability/assess-mvc/llm/client.test.ts`

The wrapper exposes a single `judge<T>(prompt, schema)` method that returns a Zod-or-JSON-Schema-validated object. We reach for `zod` here because the LLM output validation is exactly the case where commander's choices can't help. Internally the wrapper calls `query()` from `@anthropic-ai/claude-agent-sdk` with `system_prompt` carrying a "respond with JSON matching this schema" instruction, accumulates `text` from `assistant` messages, and parses.

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/llm/client.test.ts
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLlmClient } from './client.ts';

describe('LlmClient.judge', () => {
  it('parses structured JSON from a fake driver', async () => {
    const fakeDriver = vi.fn(async () => '{"verdict":"pass","reason":"ok"}');
    const client = createLlmClient({
      model: 'sonnet-4.6',
      effort: 'medium',
      verbose: false,
      driver: fakeDriver,
    });
    const schema = z.object({ verdict: z.enum(['pass', 'fail']), reason: z.string() });
    const result = await client.judge('analyze this', schema);
    expect(result).toEqual({ verdict: 'pass', reason: 'ok' });
    expect(fakeDriver).toHaveBeenCalled();
  });

  it('throws a useful error on invalid JSON', async () => {
    const fakeDriver = vi.fn(async () => 'this is not json');
    const client = createLlmClient({
      model: 'sonnet-4.6',
      effort: 'medium',
      verbose: false,
      driver: fakeDriver,
    });
    await expect(client.judge('x', z.object({ a: z.string() }))).rejects.toThrowError(/JSON/);
  });

  it('throws a useful error on schema mismatch', async () => {
    const fakeDriver = vi.fn(async () => '{"unexpected":1}');
    const client = createLlmClient({
      model: 'sonnet-4.6',
      effort: 'medium',
      verbose: false,
      driver: fakeDriver,
    });
    await expect(
      client.judge('x', z.object({ verdict: z.enum(['pass', 'fail']) })),
    ).rejects.toThrowError();
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement client.ts**

````ts
// scripts/sustainability/assess-mvc/llm/client.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ZodSchema, ZodTypeAny } from 'zod';

export type Model = 'sonnet-4.6' | 'opus-4.6' | 'haiku-4.5';
export type Effort = 'low' | 'medium' | 'high' | 'max';

export interface LlmDriverOptions {
  model: Model;
  effort: Effort;
  verbose: boolean;
}

export type LlmDriver = (prompt: string, opts: LlmDriverOptions) => Promise<string>;

export interface LlmClient {
  judge<T extends ZodTypeAny>(prompt: string, schema: T): Promise<import('zod').infer<T>>;
}

export interface CreateOptions extends LlmDriverOptions {
  driver?: LlmDriver;
}

export function createLlmClient(opts: CreateOptions): LlmClient {
  const driver = opts.driver ?? defaultDriver;
  return {
    async judge(prompt, schema) {
      const wrapped =
        prompt +
        '\n\nReturn ONLY a JSON object matching the requested schema. ' +
        'No backticks, no prose, no comments. Single JSON object.';
      const text = await driver(wrapped, {
        model: opts.model,
        effort: opts.effort,
        verbose: opts.verbose,
      });
      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(text));
      } catch (err: any) {
        throw new Error(
          `LLM did not return parseable JSON: ${err.message}; raw=${text.slice(0, 200)}`,
        );
      }
      return schema.parse(parsed);
    },
  };
}

function extractJson(text: string): string {
  // Strip optional ```json fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

async function defaultDriver(prompt: string, opts: LlmDriverOptions): Promise<string> {
  const chunks: string[] = [];
  const response = query({
    prompt,
    options: { model: opts.model, settingSources: [], permissionMode: 'default' },
  });
  for await (const message of response) {
    if (message.type === 'assistant') {
      for (const block of (message.message?.content ?? []) as any[]) {
        if (block.type === 'text' && typeof block.text === 'string') chunks.push(block.text);
      }
    }
  }
  return chunks.join('');
}
````

- [ ] **Step 4: Confirm pass**.

- [ ] **Step 5: Commit**

```bash
git add scripts/sustainability/assess-mvc/llm/
git commit -m "Add LLM client with structured-JSON judge"
```

### Task 2.2: Check 2 — real problem

**Files:**

- Create: `scripts/sustainability/assess-mvc/checks/real-problem.ts`
- Test: `scripts/sustainability/assess-mvc/checks/real-problem.test.ts`

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/checks/real-problem.test.ts
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { checkRealProblem } from './real-problem.ts';

const baseCtx = {
  title: 't',
  body: 'b',
  labels: [] as string[],
  files: [] as any[],
  linkedIssues: [] as any[],
  brokenLinkRefs: [] as string[],
};

const llm = (output: unknown) => ({
  async judge<T extends z.ZodTypeAny>(_p: string, _s: T) {
    return output as any;
  },
});

describe('checkRealProblem', () => {
  it('FAIL when there are no linked issues', async () => {
    const r = await checkRealProblem({ ctx: baseCtx, llm: llm({}) });
    expect(r.status).toBe('fail');
    expect(r.evidence).toMatch(/no linked issue/i);
  });

  it('FAIL when the only linked issue is closed', async () => {
    const ctx = {
      ...baseCtx,
      linkedIssues: [{ state: 'closed', url: 'u', number: 1, owner: 'o', repo: 'r' }],
    };
    const r = await checkRealProblem({ ctx, llm: llm({}) });
    expect(r.status).toBe('fail');
  });

  it('PASS when LLM judges the PR substantively addresses an open linked issue', async () => {
    const ctx = {
      ...baseCtx,
      linkedIssues: [
        {
          state: 'open',
          url: 'u',
          number: 1,
          owner: 'o',
          repo: 'r',
          labels: ['bug'],
          title: 'I',
          body: 'b',
        },
      ],
    };
    const r = await checkRealProblem({
      ctx,
      llm: llm({ matchesIssue: true, category: 'bug', reasoning: 'fixes core path' }),
    });
    expect(r.status).toBe('pass');
  });

  it('FAIL when LLM says the PR does not match the issue', async () => {
    const ctx = {
      ...baseCtx,
      linkedIssues: [
        {
          state: 'open',
          url: 'u',
          number: 1,
          owner: 'o',
          repo: 'r',
          labels: [],
          title: 'I',
          body: 'b',
        },
      ],
    };
    const r = await checkRealProblem({
      ctx,
      llm: llm({ matchesIssue: false, category: 'bug', reasoning: 'tangential' }),
    });
    expect(r.status).toBe('fail');
  });

  it('FAIL for feature PRs that do not fit any of the three accepted categories', async () => {
    const ctx = {
      ...baseCtx,
      labels: ['feature request'],
      linkedIssues: [
        {
          state: 'open',
          url: 'u',
          number: 1,
          owner: 'o',
          repo: 'r',
          labels: ['feature request'],
          title: 'I',
          body: 'b',
        },
      ],
    };
    const r = await checkRealProblem({
      ctx,
      llm: llm({
        matchesIssue: true,
        category: 'feature',
        reasoning: 'matches',
        featureFit: 'none',
      }),
    });
    expect(r.status).toBe('fail');
  });

  it('PASS for feature PRs that fit one of the three accepted categories', async () => {
    const ctx = {
      ...baseCtx,
      labels: ['feature request'],
      linkedIssues: [
        {
          state: 'open',
          url: 'u',
          number: 1,
          owner: 'o',
          repo: 'r',
          labels: ['feature request'],
          title: 'I',
          body: 'b',
        },
      ],
    };
    const r = await checkRealProblem({
      ctx,
      llm: llm({
        matchesIssue: true,
        category: 'feature',
        reasoning: 'matches',
        featureFit: 'augments-api',
      }),
    });
    expect(r.status).toBe('pass');
  });
});
```

- [ ] **Step 2: Confirm failure**.

- [ ] **Step 3: Implement**

```ts
// scripts/sustainability/assess-mvc/checks/real-problem.ts
import { z } from 'zod';
import type { CheckResult, PrContext } from '../types.ts';
import type { LlmClient } from '../llm/client.ts';

const FEATURE_FITS = ['augments-api', 'popular-tech', 'quality-of-life', 'none'] as const;
const Schema = z.object({
  matchesIssue: z.boolean(),
  category: z.enum(['bug', 'feature', 'maintenance', 'docs', 'dependencies', 'other']),
  reasoning: z.string(),
  featureFit: z.enum(FEATURE_FITS).optional(),
});

export interface CheckDeps {
  ctx: Pick<PrContext, 'title' | 'body' | 'labels' | 'files' | 'linkedIssues' | 'brokenLinkRefs'>;
  llm: LlmClient;
}

export async function checkRealProblem(deps: CheckDeps): Promise<CheckResult> {
  const { ctx, llm } = deps;
  const openIssues = ctx.linkedIssues.filter((i) => i.state === 'open');
  if (ctx.linkedIssues.length === 0) {
    return {
      id: 'real-problem',
      status: 'fail',
      evidence: 'No linked issue.',
      guidance:
        'Link an existing open issue this PR addresses. Without a linked issue, we cannot verify the change solves a tracked problem.',
    };
  }
  if (openIssues.length === 0) {
    return {
      id: 'real-problem',
      status: 'fail',
      evidence: 'All linked issues are closed.',
      guidance:
        'The linked issue is closed. If the problem regressed, please reopen it (or open a fresh one) and link that.',
    };
  }

  const prompt = buildPrompt(ctx, openIssues);
  const judgment = await llm.judge(prompt, Schema);

  if (!judgment.matchesIssue) {
    return {
      id: 'real-problem',
      status: 'fail',
      evidence: `LLM judged the PR does not substantively address the linked issue: ${judgment.reasoning}`,
      guidance:
        'Re-read the linked issue and either revise the PR to address its core ask or link the correct issue.',
    };
  }

  if (judgment.category === 'feature') {
    const fit = judgment.featureFit ?? 'none';
    if (fit === 'none') {
      return {
        id: 'real-problem',
        status: 'fail',
        evidence:
          'Feature does not fit accepted categories (augments-API / popular-tech / quality-of-life).',
        guidance:
          'Features must augment APIs for addon authors, add support for popular tech, or improve QoL. Consider shipping this in the addon ecosystem.',
      };
    }
  }

  const broken =
    ctx.brokenLinkRefs.length > 0 ? ` (warn: broken refs ${ctx.brokenLinkRefs.join(', ')})` : '';
  return {
    id: 'real-problem',
    status: broken ? 'warn' : 'pass',
    evidence: `Matches linked issue (${judgment.category}): ${judgment.reasoning}${broken}`,
  };
}

function buildPrompt(ctx: CheckDeps['ctx'], openIssues: PrContext['linkedIssues']): string {
  const issues = openIssues
    .map(
      (i) =>
        `### Linked issue ${i.owner}/${i.repo}#${i.number} — ${i.title}\nLabels: ${i.labels.join(', ')}\n\n${i.body}`,
    )
    .join('\n\n');
  return [
    'You are reviewing a Storybook pull request for the MVC "real problem" check.',
    '',
    `PR title: ${ctx.title}`,
    `PR labels: ${ctx.labels.join(', ')}`,
    'PR body:',
    ctx.body,
    '',
    'Linked issues:',
    issues,
    '',
    'Decide:',
    '- matchesIssue: does the PR substantively address the linked issue? (not tangential, not different problem)',
    '- category: one of bug | feature | maintenance | docs | dependencies | other',
    '- featureFit (only if category=feature): augments-api | popular-tech | quality-of-life | none',
    '- reasoning: one short sentence (≤ 200 chars)',
  ].join('\n');
}
```

- [ ] **Step 4: Confirm pass**.

- [ ] **Step 5: Commit**

```bash
git add scripts/sustainability/assess-mvc/checks/real-problem.ts scripts/sustainability/assess-mvc/checks/real-problem.test.ts
git commit -m "Add Check 2 (real problem) with feature sub-rule"
```

### Task 2.3: Check 4 — cost/benefit

**Files:**

- Create: `scripts/sustainability/assess-mvc/checks/cost-benefit.ts`
- Test: `scripts/sustainability/assess-mvc/checks/cost-benefit.test.ts`
- Create: `scripts/sustainability/assess-mvc/github/reactions.ts`
- Modify: `scripts/sustainability/assess-mvc/precomputes/cyclomatic.ts` (no change; consumed here)

- [ ] **Step 1: Implement reactions.ts (no tests — trivial)**

```ts
// scripts/sustainability/assess-mvc/github/reactions.ts
import type { GithubClient } from './client.ts';

export interface Reactions {
  plus1: number;
  minus1: number;
  tada: number;
}

export async function fetchIssueReactions(
  client: GithubClient,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<Reactions> {
  const { data } = await client.rest('GET /repos/{owner}/{repo}/issues/{issue_number}', {
    owner,
    repo,
    issue_number: issueNumber,
  });
  const r = data.reactions ?? {};
  return { plus1: r['+1'] ?? 0, minus1: r['-1'] ?? 0, tada: r.hooray ?? 0 };
}
```

- [ ] **Step 2: Failing test for cost-benefit**

```ts
// scripts/sustainability/assess-mvc/checks/cost-benefit.test.ts
import { describe, expect, it } from 'vitest';
import { checkCostBenefit } from './cost-benefit.ts';

const llm = (output: unknown) =>
  ({
    async judge() {
      return output as any;
    },
  }) as any;

const baseInputs = {
  diffMetrics: { filesChanged: 1, added: 10, removed: 2, net: 8, files: ['a.ts'] },
  cyclomatic: [] as any[],
  deps: { runtime: [], peer: [] },
  benefit: {
    severity: null as string | null,
    reactions: { plus1: 0, minus1: 0, tada: 0 },
    comments: 0,
  },
};

describe('checkCostBenefit', () => {
  it('PASS for trivial diff regardless of LLM verdict (small-change short-circuit)', async () => {
    const r = await checkCostBenefit({
      ...baseInputs,
      llm: llm({ verdict: 'fail', reasoning: 'doesnt matter' }),
    });
    expect(r.status).toBe('pass');
  });

  it('relays LLM PASS for larger changes', async () => {
    const r = await checkCostBenefit({
      ...baseInputs,
      diffMetrics: { ...baseInputs.diffMetrics, added: 200, net: 198 },
      llm: llm({ verdict: 'pass', reasoning: 'proportionate' }),
    });
    expect(r.status).toBe('pass');
  });

  it('relays LLM WARN', async () => {
    const r = await checkCostBenefit({
      ...baseInputs,
      diffMetrics: { ...baseInputs.diffMetrics, added: 200, net: 198 },
      llm: llm({ verdict: 'warn', reasoning: 'some concerns' }),
    });
    expect(r.status).toBe('warn');
  });

  it('relays LLM FAIL', async () => {
    const r = await checkCostBenefit({
      ...baseInputs,
      diffMetrics: { ...baseInputs.diffMetrics, added: 800, net: 700 },
      cyclomatic: [{ path: 'a.ts', functions: [{ name: 'f', complexity: 30 }] }],
      llm: llm({ verdict: 'fail', reasoning: 'edge case low engagement large diff' }),
    });
    expect(r.status).toBe('fail');
  });
});
```

- [ ] **Step 3: Implement**

```ts
// scripts/sustainability/assess-mvc/checks/cost-benefit.ts
import { z } from 'zod';
import type { CheckResult } from '../types.ts';
import type { LlmClient } from '../llm/client.ts';
import type { DiffMetrics } from '../precomputes/diff-metrics.ts';
import type { AddedDeps } from '../precomputes/dependencies.ts';
import type { FunctionComplexity } from '../precomputes/cyclomatic.ts';

const SMALL_CHANGE_NET_LOC = 30;

const Schema = z.object({
  verdict: z.enum(['pass', 'warn', 'fail']),
  reasoning: z.string(),
});

export interface BenefitSignals {
  severity: string | null; // sev:S1..S4 or null
  reactions: { plus1: number; minus1: number; tada: number };
  comments: number;
}

export interface CostBenefitInputs {
  diffMetrics: DiffMetrics;
  cyclomatic: Array<{ path: string; functions: FunctionComplexity[] }>;
  deps: AddedDeps;
  benefit: BenefitSignals;
  llm: LlmClient;
}

export async function checkCostBenefit(input: CostBenefitInputs): Promise<CheckResult> {
  if (
    input.diffMetrics.net <= SMALL_CHANGE_NET_LOC &&
    input.deps.runtime.length === 0 &&
    input.deps.peer.length === 0
  ) {
    return {
      id: 'cost-benefit',
      status: 'pass',
      evidence: `Small change (${input.diffMetrics.net} net LOC); cost/benefit defaults to PASS.`,
    };
  }

  const prompt = buildPrompt(input);
  const j = await input.llm.judge(prompt, Schema);

  return {
    id: 'cost-benefit',
    status: j.verdict,
    evidence: `${j.verdict.toUpperCase()}: ${j.reasoning}`,
    guidance:
      j.verdict === 'fail'
        ? 'Consider splitting the PR, narrowing to the core issue, or shipping experimental scope in an addon.'
        : undefined,
  };
}

function buildPrompt(input: CostBenefitInputs): string {
  const top = input.cyclomatic
    .flatMap((f) => f.functions.map((fn) => ({ path: f.path, ...fn })))
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 5);
  return [
    'You are reviewing a Storybook pull request for the MVC "cost/benefit" check.',
    'FAIL requires CLEAR evidence of mismatch. Default to WARN under uncertainty. Default to PASS for small changes.',
    'Edge-case linked issues warrant a stricter maintenance ceiling than broad ones.',
    '',
    `Diff: +${input.diffMetrics.added}/-${input.diffMetrics.removed} (net ${input.diffMetrics.net}) across ${input.diffMetrics.filesChanged} files.`,
    `Added runtime deps: ${input.deps.runtime.join(', ') || '(none)'}`,
    `Added peer deps: ${input.deps.peer.join(', ') || '(none)'}`,
    `Top complexity hot-spots: ${top.map((t) => `${t.path}:${t.name}=${t.complexity}`).join(', ') || '(none)'}`,
    '',
    `Linked-issue severity: ${input.benefit.severity ?? '(none)'}`,
    `Reactions: +${input.benefit.reactions.plus1} -${input.benefit.reactions.minus1} tada=${input.benefit.reactions.tada}`,
    `Comment count: ${input.benefit.comments}`,
    '',
    'Return JSON: { verdict: "pass"|"warn"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
}
```

- [ ] **Step 4: Confirm pass**.

- [ ] **Step 5: Commit**

```bash
git add scripts/sustainability/assess-mvc/checks/cost-benefit.ts scripts/sustainability/assess-mvc/checks/cost-benefit.test.ts scripts/sustainability/assess-mvc/github/reactions.ts
git commit -m "Add Check 4 (cost/benefit) with precomputes + LLM"
```

### Task 2.4: Check 5 — explains how to test

**Files:**

- Create: `scripts/sustainability/assess-mvc/checks/explains-how-to-test.ts`
- Test: `scripts/sustainability/assess-mvc/checks/explains-how-to-test.test.ts`

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/checks/explains-how-to-test.test.ts
import { describe, expect, it } from 'vitest';
import { checkExplainsHowToTest } from './explains-how-to-test.ts';

const llm = (output: unknown) =>
  ({
    async judge() {
      return output as any;
    },
  }) as any;

const ctx = {
  body: 'PR description without testing section.',
  files: [{ path: 'a.ts', additions: 1, deletions: 0, status: 'modified' }] as any,
  linkedIssues: [] as any[],
};

describe('checkExplainsHowToTest', () => {
  it('FAIL when LLM judges instructions absent or self-report-only', async () => {
    const r = await checkExplainsHowToTest({
      ctx,
      llm: llm({ verdict: 'fail', reasoning: 'empty section' }),
    });
    expect(r.status).toBe('fail');
  });

  it('PASS when LLM judges reproducible third-party steps', async () => {
    const r = await checkExplainsHowToTest({
      ctx,
      llm: llm({ verdict: 'pass', reasoning: 'concrete steps' }),
    });
    expect(r.status).toBe('pass');
  });
});
```

- [ ] **Step 2: Implement**

```ts
// scripts/sustainability/assess-mvc/checks/explains-how-to-test.ts
import { z } from 'zod';
import type { CheckResult, PrContext } from '../types.ts';
import type { LlmClient } from '../llm/client.ts';

const Schema = z.object({
  verdict: z.enum(['pass', 'fail']),
  reasoning: z.string(),
});

export interface Inputs {
  ctx: Pick<PrContext, 'body' | 'files' | 'linkedIssues'>;
  llm: LlmClient;
}

export async function checkExplainsHowToTest(input: Inputs): Promise<CheckResult> {
  const prompt = [
    'You are evaluating the MVC "explains how to test" check on a Storybook PR.',
    'PASS only if a third-party reader can verify the fix works.',
    '- Steps must be user-action framed (CLI commands, UI navigation), NOT unit-test invocations decoupled from user behavior.',
    '- Steps must be reproducible — NOT author self-report ("I tested it locally"). ',
    '- Steps must exercise what the diff actually changes.',
    'FAIL otherwise. Media (screenshots/videos) is out of scope; do NOT require it.',
    '',
    'PR body:',
    input.ctx.body,
    '',
    'Linked issue bodies (acceptable as fallback if they read as a verification recipe):',
    input.ctx.linkedIssues
      .map((i) => `### ${i.owner}/${i.repo}#${i.number}\n${i.body}`)
      .join('\n\n') || '(none)',
    '',
    'Diff overview:',
    input.ctx.files.map((f) => `- ${f.path} (+${f.additions}/-${f.deletions})`).join('\n'),
    '',
    'Return JSON: { verdict: "pass"|"fail", reasoning: "one short sentence" }',
  ].join('\n');

  const j = await input.llm.judge(prompt, Schema);
  return {
    id: 'explains-test',
    status: j.verdict,
    evidence: `${j.verdict.toUpperCase()}: ${j.reasoning}`,
    guidance:
      j.verdict === 'fail'
        ? 'Add a "Manual testing" section with reproducible user-facing steps (CLI/UI). Avoid self-reports and unit-only assertions.'
        : undefined,
  };
}
```

- [ ] **Step 3: Confirm pass**.

- [ ] **Step 4: Commit**

```bash
git add scripts/sustainability/assess-mvc/checks/explains-how-to-test.ts scripts/sustainability/assess-mvc/checks/explains-how-to-test.test.ts
git commit -m "Add Check 5 (explains how to test)"
```

### Task 2.5: Check 6 — provides context

**Files:**

- Create: `scripts/sustainability/assess-mvc/checks/provides-context.ts`
- Test: `scripts/sustainability/assess-mvc/checks/provides-context.test.ts`

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/checks/provides-context.test.ts
import { describe, expect, it } from 'vitest';
import { checkProvidesContext } from './provides-context.ts';

const llm = (output: unknown) =>
  ({
    async judge() {
      return output as any;
    },
  }) as any;

const ctx = {
  body: '## What I did\n…',
  files: [] as any[],
  linkedIssues: [] as any[],
  diffMetrics: { filesChanged: 1, added: 3, removed: 0, net: 3, files: ['a.ts'] },
};

describe('checkProvidesContext', () => {
  it('PASS for trivial diff via self-evident branch (no LLM)', async () => {
    const r = await checkProvidesContext({
      ctx,
      llm: llm({ verdict: 'fail', reasoning: 'ignored' }),
    });
    expect(r.status).toBe('pass');
  });

  it('relays LLM for non-trivial diff', async () => {
    const r = await checkProvidesContext({
      ctx: {
        ...ctx,
        diffMetrics: { filesChanged: 10, added: 200, removed: 50, net: 150, files: [] },
      },
      llm: llm({ verdict: 'fail', reasoning: 'no rationale' }),
    });
    expect(r.status).toBe('fail');
  });
});
```

- [ ] **Step 2: Implement**

```ts
// scripts/sustainability/assess-mvc/checks/provides-context.ts
import { z } from 'zod';
import type { CheckResult, PrContext } from '../types.ts';
import type { LlmClient } from '../llm/client.ts';
import type { DiffMetrics } from '../precomputes/diff-metrics.ts';

const TRIVIAL_NET_LOC = 15;
const Schema = z.object({
  verdict: z.enum(['pass', 'fail']),
  reasoning: z.string(),
});

export interface Inputs {
  ctx: Pick<PrContext, 'body' | 'files' | 'linkedIssues'> & { diffMetrics: DiffMetrics };
  llm: LlmClient;
}

export async function checkProvidesContext(input: Inputs): Promise<CheckResult> {
  if (input.ctx.diffMetrics.net <= TRIVIAL_NET_LOC) {
    return {
      id: 'provides-context',
      status: 'pass',
      evidence: 'Trivial diff; rationale self-evident.',
    };
  }
  const prompt = [
    'You are evaluating the MVC "provides context" check on a Storybook PR.',
    'PASS if the PR body explains WHY the author chose this approach, OR the rationale is self-evident from the diff + linked issue.',
    'FAIL only if a reviewer would have to guess at intent.',
    'Bias toward PASS for well-aligned PRs.',
    '',
    'PR body:',
    input.ctx.body,
    '',
    'Linked issues:',
    input.ctx.linkedIssues
      .map((i) => `### ${i.owner}/${i.repo}#${i.number} — ${i.title}\n${i.body}`)
      .join('\n\n') || '(none)',
    '',
    `Diff: +${input.ctx.diffMetrics.added}/-${input.ctx.diffMetrics.removed} across ${input.ctx.diffMetrics.filesChanged} files.`,
    '',
    'Return JSON: { verdict: "pass"|"fail", reasoning: "one short sentence" }',
  ].join('\n');
  const j = await input.llm.judge(prompt, Schema);
  return {
    id: 'provides-context',
    status: j.verdict,
    evidence: `${j.verdict.toUpperCase()}: ${j.reasoning}`,
    guidance:
      j.verdict === 'fail'
        ? 'Add a short "Why" section explaining the approach you chose and any alternatives considered.'
        : undefined,
  };
}
```

- [ ] **Step 3: Confirm pass**.

- [ ] **Step 4: Commit**

```bash
git add scripts/sustainability/assess-mvc/checks/provides-context.ts scripts/sustainability/assess-mvc/checks/provides-context.test.ts
git commit -m "Add Check 6 (provides context) with self-evident short-circuit"
```

### Task 2.6: Canned responses module

**Files:**

- Create: `scripts/sustainability/assess-mvc/canned-responses.ts`
- Test: `scripts/sustainability/assess-mvc/canned-responses.test.ts`

Placeholder constants per spec section 12 TODO; final copy is added later.

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/canned-responses.test.ts
import { describe, expect, it } from 'vitest';
import { CANNED, OVERALL } from './canned-responses.ts';

describe('canned responses', () => {
  it('exposes one entry per CheckId', () => {
    expect(Object.keys(CANNED).sort()).toEqual(
      [
        'cost-benefit',
        'duplicate',
        'explains-test',
        'human',
        'provides-context',
        'real-problem',
      ].sort(),
    );
    for (const value of Object.values(CANNED)) {
      expect(value).toMatch(/TODO\(copy\)/); // every template is currently a placeholder
    }
  });

  it('exposes pass and fail overall templates', () => {
    expect(OVERALL.pass).toMatch(/TODO\(copy\)/);
    expect(OVERALL.fail).toMatch(/TODO\(copy\)/);
  });
});
```

- [ ] **Step 2: Implement (placeholders only)**

```ts
// scripts/sustainability/assess-mvc/canned-responses.ts
import type { CheckId } from './types.ts';

/**
 * Per-criterion canned responses. The synthesis LLM call uses these as a starting
 * point and tailors PR-specific specifics. Final copy lands in a follow-up PR after
 * author review (spec section 12 TODO).
 */
export const CANNED: Record<CheckId, string> = {
  human: 'TODO(copy): explain that MVC review is only run on human-authored PRs.',
  'real-problem': 'TODO(copy): coach the author on linking an open issue that this PR addresses.',
  duplicate: 'TODO(copy): coach the author when another PR already addresses the same issue.',
  'cost-benefit':
    'TODO(copy): explain the cost/benefit reasoning and suggest narrowing or addon scope.',
  'explains-test': 'TODO(copy): ask for reproducible third-party test instructions.',
  'provides-context': 'TODO(copy): ask for a short "Why" rationale.',
};

export const OVERALL = {
  pass: 'TODO(copy): friendly confirmation that the PR meets MVC; reviewer queue follows.',
  fail: 'TODO(copy): constructive frame — automation identified ways to improve; not a personal judgment.',
};
```

- [ ] **Step 3: Confirm pass**.

- [ ] **Step 4: Commit**

```bash
git add scripts/sustainability/assess-mvc/canned-responses.ts scripts/sustainability/assess-mvc/canned-responses.test.ts
git commit -m "Add canned-responses placeholders for review body composition"
```

### Task 2.7: Synthesis call

**Files:**

- Create: `scripts/sustainability/assess-mvc/llm/synthesis.ts`
- Test: `scripts/sustainability/assess-mvc/llm/synthesis.test.ts`

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/llm/synthesis.test.ts
import { describe, expect, it } from 'vitest';
import { synthesizeReview } from './synthesis.ts';
import { MARKER } from '../config.ts';

const llm = (output: unknown) =>
  ({
    async judge() {
      return output as any;
    },
  }) as any;

describe('synthesizeReview', () => {
  it('returns a string including the marker', async () => {
    const body = await synthesizeReview({
      pr: { title: 't', url: 'u', author: 'a' },
      results: [{ id: 'human', status: 'pass', evidence: 'ok' }],
      earlyAbort: false,
      llm: llm({ reviewBody: 'composed' }),
    });
    expect(body).toContain(MARKER);
    expect(body).toContain('composed');
  });

  it('lists not-performed LLM checks when early-aborted', async () => {
    const body = await synthesizeReview({
      pr: { title: 't', url: 'u', author: 'a' },
      results: [
        { id: 'human', status: 'pass', evidence: 'ok' },
        { id: 'duplicate', status: 'fail', evidence: 'dupe of #1' },
        { id: 'real-problem', status: 'deferred', evidence: 'skipped' },
      ],
      earlyAbort: true,
      llm: llm({ reviewBody: 'composed' }),
    });
    expect(body).toContain('not performed');
    expect(body).toContain('real-problem');
  });
});
```

- [ ] **Step 2: Implement**

```ts
// scripts/sustainability/assess-mvc/llm/synthesis.ts
import { z } from 'zod';
import type { LlmClient } from './client.ts';
import { CANNED, OVERALL } from '../canned-responses.ts';
import { MARKER } from '../config.ts';
import type { CheckResult } from '../types.ts';

const Schema = z.object({ reviewBody: z.string() });

export interface SynthesisInput {
  pr: { title: string; url: string; author: string };
  results: CheckResult[];
  earlyAbort: boolean;
  llm: LlmClient;
}

export async function synthesizeReview(input: SynthesisInput): Promise<string> {
  const verdict = input.results.some((r) => r.status === 'fail') ? 'fail' : 'pass';
  const tailoring = input.results
    .map(
      (r) =>
        `- [${r.status.toUpperCase()}] ${r.id}: ${r.evidence}\n  Canned template: ${CANNED[r.id]}`,
    )
    .join('\n');
  const notPerformed = input.results.filter((r) => r.status === 'deferred').map((r) => r.id);
  const prompt = [
    'Compose a Storybook PR review body in markdown that the author and other reviewers will read.',
    'Voice: constructive, friendly, never accusatory ("our automation has identified ways to improve").',
    '',
    `Overall verdict template:\n${verdict === 'pass' ? OVERALL.pass : OVERALL.fail}`,
    '',
    'Per-check tailoring (start from the canned template; tailor with PR-specific evidence; drop irrelevant sentences):',
    tailoring,
    '',
    input.earlyAbort
      ? `IMPORTANT: deterministic checks failed. The following LLM-judged checks were NOT performed and must be listed in the body so the author knows they remain to be evaluated: ${notPerformed.join(', ')}.`
      : '',
    '',
    'Return JSON: { "reviewBody": "<markdown>" }. Do NOT include the HTML marker; it is appended by the script.',
  ]
    .filter(Boolean)
    .join('\n');

  const { reviewBody } = await input.llm.judge(prompt, Schema);
  return `${MARKER}\n${reviewBody}`;
}
```

- [ ] **Step 3: Confirm pass**.

- [ ] **Step 4: Commit**

```bash
git add scripts/sustainability/assess-mvc/llm/synthesis.ts scripts/sustainability/assess-mvc/llm/synthesis.test.ts
git commit -m "Add LLM synthesis to compose the review body"
```

### Task 2.8: Wire LLM phase into CLI

**Files:**

- Modify: `scripts/sustainability/assess-mvc.ts` (replace the Phase-1 LLM stubs in `buildDeps` with real LLM-backed implementations)
- Modify: `scripts/sustainability/assess-mvc.test.ts` (extend integration test for early-abort behavior)

- [ ] **Step 1: Extend the integration test**

```ts
// add to scripts/sustainability/assess-mvc.test.ts
it('skips LLM phase on early-abort (Check 3 FAIL)', async () => {
  const judgeCalls: string[] = [];
  const result = await runAssessment({
    coords: { owner: 'storybookjs', repo: 'storybook', number: 1 },
    flags: {
      dryRun: true,
      dismissPrevious: false,
      respectSkipRules: false,
      model: 'sonnet-4.6',
      effort: 'medium',
      verbose: false,
    },
    deps: {
      fetchPrContext: async () => ({
        owner: 'storybookjs',
        repo: 'storybook',
        number: 1,
        url: 'u',
        title: 't',
        body: '',
        author: 'a',
        isDraft: false,
        headSha: 'sha',
        labels: ['agent-scan:human'],
        files: [],
        linkedIssues: [
          {
            owner: 'storybookjs',
            repo: 'storybook',
            number: 2,
            url: 'u',
            title: 'I',
            body: '',
            state: 'open',
            labels: [],
          },
        ],
        brokenLinkRefs: [],
      }),
      duplicateLookup: async () => ({
        crossRefs: [{ prNumber: 999, prState: 'open', merged: false }],
        timeline: [],
      }),
      isMaintainer: async () => false,
      llmJudge: async (id) => {
        judgeCalls.push(id);
        return { id, status: 'pass', evidence: 'unused' };
      },
      synthesizeReview: async () => 'body',
      writes: {
        addLabels: async () => {},
        removeLabels: async () => {},
        submitReview: async () => {},
        dismissPriorReviews: async () => {},
      },
    },
  });
  expect(result.verdict).toBe('fail');
  expect(result.earlyAbort).toBe(true);
  expect(judgeCalls).toEqual([]); // LLM judges never invoked
});
```

- [ ] **Step 2: Wire real LLM-backed deps**

In `assess-mvc.ts`, replace the Phase-1 `llmJudge` and `synthesizeReview` in `buildDeps`. Add imports for the four checks, the LLM client, the precomputes, and `synthesizeReview`. The pseudo-shape:

```ts
import { createLlmClient } from './assess-mvc/llm/client.ts';
import { synthesizeReview } from './assess-mvc/llm/synthesis.ts';
import { checkRealProblem } from './assess-mvc/checks/real-problem.ts';
import { checkCostBenefit } from './assess-mvc/checks/cost-benefit.ts';
import { checkExplainsHowToTest } from './assess-mvc/checks/explains-how-to-test.ts';
import { checkProvidesContext } from './assess-mvc/checks/provides-context.ts';
import { computeDiffMetrics } from './assess-mvc/precomputes/diff-metrics.ts';
import { computeAddedDependencies } from './assess-mvc/precomputes/dependencies.ts';
import { complexityForChangedFiles } from './assess-mvc/precomputes/cyclomatic.ts';
import { fetchIssueReactions } from './assess-mvc/github/reactions.ts';

// in buildDeps:
const llm = createLlmClient({ model: flags.model, effort: flags.effort, verbose: flags.verbose });

async function fetchContents(path: string, sha: string): Promise<string | null> {
  try {
    const { data } = await client.rest('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'storybookjs',
      repo: 'storybook',
      path,
      ref: sha,
    });
    if (Array.isArray(data) || !('content' in data)) return null;
    return Buffer.from(data.content, data.encoding ?? 'base64').toString('utf-8');
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

return {
  // …fetchPrContext same as Phase 1…
  duplicateLookup: githubDuplicateLookup(client),
  isMaintainer: githubTeamMembership(client).isMaintainer,
  async llmJudge(id, ctx) {
    if (id === 'real-problem') return checkRealProblem({ ctx, llm });
    if (id === 'cost-benefit') {
      const diffMetrics = computeDiffMetrics(ctx.files);
      const deps = computeAddedDependencies(ctx.files);
      const cyclomatic = await complexityForChangedFiles(fetchContents, ctx.files, ctx.headSha);
      const firstIssue = ctx.linkedIssues[0];
      const severity = firstIssue?.labels.find((l: string) => /^sev:S[1-4]$/.test(l)) ?? null;
      const reactions = firstIssue
        ? await fetchIssueReactions(client, firstIssue.owner, firstIssue.repo, firstIssue.number)
        : { plus1: 0, minus1: 0, tada: 0 };
      const comments = 0; // populated by the issue fetch in a follow-up if useful — out of v1
      return checkCostBenefit({
        diffMetrics,
        cyclomatic,
        deps,
        benefit: { severity, reactions, comments },
        llm,
      });
    }
    if (id === 'explains-test') return checkExplainsHowToTest({ ctx, llm });
    if (id === 'provides-context') {
      return checkProvidesContext({
        ctx: { ...ctx, diffMetrics: computeDiffMetrics(ctx.files) },
        llm,
      });
    }
    return { id, status: 'deferred', evidence: 'Unknown LLM check id' };
  },
  async synthesizeReview({ pr, results, earlyAbort }) {
    return synthesizeReview({
      pr: { title: pr.title, url: pr.url, author: pr.author },
      results,
      earlyAbort,
      llm,
    });
  },
  writes: {
    addLabels: async () => {},
    removeLabels: async () => {},
    submitReview: async () => {},
    dismissPriorReviews: async () => {},
  },
};
```

- [ ] **Step 3: Confirm tests pass**

Run: `cd /home/steve/Development/storybook && yarn vitest run --project scripts scripts/sustainability/`
Expected: PASS for all tests.

- [ ] **Step 4: Smoke test against a real PR (manual)**

```bash
ANTHROPIC_API_KEY=… GH_TOKEN=$(gh auth token) node scripts/sustainability/assess-mvc.ts <some-open-pr-number>
```

Verify the summary table renders, no errors, all six checks show statuses (no `deferred` outside Check 1's defer path).

- [ ] **Step 5: Commit**

```bash
yarn fmt:write
git add scripts/sustainability/assess-mvc.ts scripts/sustainability/assess-mvc.test.ts
git commit -m "Wire LLM checks and synthesis into CLI"
```

**Phase 2 checkpoint:** Tag `phase-2`. The CLI now performs a full assessment in dry-run, but still does not write anything to GitHub. Output quality is the right thing to spot-check by running against ~5 representative PRs before moving to Phase 3.

---

## Phase 3 — Live Mode + Packaging

**Phase goal:** Add label/review write paths, the CI workflow (triggers commented out), and the agent skill. Produce the validation deliverable.

### Task 3.1: Label management

**Files:**

- Create: `scripts/sustainability/assess-mvc/github/labels.ts`
- Test: `scripts/sustainability/assess-mvc/github/labels.test.ts`

- [ ] **Step 1: Failing test**

```ts
// scripts/sustainability/assess-mvc/github/labels.test.ts
import { describe, expect, it, vi } from 'vitest';
import { addLabels, removeLabels } from './labels.ts';

describe('addLabels / removeLabels', () => {
  it('POSTs the add-labels endpoint', async () => {
    const rest = vi.fn(async () => ({ data: [] }));
    await addLabels({ rest, graphql: vi.fn() } as any, { owner: 'o', repo: 'r', number: 1 }, [
      'mvc:success',
    ]);
    expect(rest).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
      expect.objectContaining({
        owner: 'o',
        repo: 'r',
        issue_number: 1,
        labels: ['mvc:success'],
      }),
    );
  });

  it('DELETEs each label individually', async () => {
    const rest = vi.fn(async () => ({ data: [] }));
    await removeLabels({ rest, graphql: vi.fn() } as any, { owner: 'o', repo: 'r', number: 1 }, [
      'mvc:skip',
      'mvc:pending',
    ]);
    expect(rest).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// scripts/sustainability/assess-mvc/github/labels.ts
import type { GithubClient } from './client.ts';

export async function addLabels(
  client: GithubClient,
  pr: { owner: string; repo: string; number: number },
  labels: string[],
): Promise<void> {
  if (labels.length === 0) return;
  await client.rest('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
    owner: pr.owner,
    repo: pr.repo,
    issue_number: pr.number,
    labels,
  });
}

export async function removeLabels(
  client: GithubClient,
  pr: { owner: string; repo: string; number: number },
  labels: string[],
): Promise<void> {
  for (const label of labels) {
    try {
      await client.rest('DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}', {
        owner: pr.owner,
        repo: pr.repo,
        issue_number: pr.number,
        name: label,
      });
    } catch (err: any) {
      if (err?.status === 404) continue; // label wasn't present
      throw err;
    }
  }
}
```

- [ ] **Step 3: Confirm pass**.

- [ ] **Step 4: Commit**

```bash
git add scripts/sustainability/assess-mvc/github/labels.ts scripts/sustainability/assess-mvc/github/labels.test.ts
git commit -m "Add label add/remove helpers"
```

### Task 3.2: Review submission + dismissal

**Files:**

- Create: `scripts/sustainability/assess-mvc/github/review.ts`
- Test: `scripts/sustainability/assess-mvc/github/review.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// scripts/sustainability/assess-mvc/github/review.test.ts
import { describe, expect, it, vi } from 'vitest';
import { submitReview, dismissPriorReviews } from './review.ts';
import { MARKER } from '../config.ts';

describe('submitReview', () => {
  it('POSTs with COMMENT for pass and REQUEST_CHANGES for fail, marker prepended', async () => {
    const rest = vi.fn(async () => ({ data: {} }));
    await submitReview(
      { rest, graphql: vi.fn() } as any,
      { owner: 'o', repo: 'r', number: 1 },
      { event: 'COMMENT', body: 'hi' },
    );
    expect(rest).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      expect.objectContaining({
        event: 'COMMENT',
        body: expect.stringContaining(MARKER),
      }),
    );
  });
});

describe('dismissPriorReviews', () => {
  it('dismisses only bot reviews carrying the marker', async () => {
    const rest = vi.fn(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews') {
        return {
          data: [
            { id: 1, user: { login: 'someone-else' }, body: 'human comment', state: 'COMMENTED' },
            {
              id: 2,
              user: { login: 'someone-else' },
              body: `${MARKER}\nold review`,
              state: 'CHANGES_REQUESTED',
            },
            {
              id: 3,
              user: { login: 'someone-else' },
              body: 'no marker',
              state: 'CHANGES_REQUESTED',
            },
          ],
        };
      }
      return { data: {} };
    });
    await dismissPriorReviews({ rest, graphql: vi.fn() } as any, {
      owner: 'o',
      repo: 'r',
      number: 1,
    });
    expect(rest).toHaveBeenCalledWith(
      'PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals',
      expect.objectContaining({
        review_id: 2,
      }),
    );
    // not called for 1 or 3
    const calls = rest.mock.calls.filter(
      ([route]) =>
        route === 'PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals',
    );
    expect(calls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// scripts/sustainability/assess-mvc/github/review.ts
import type { GithubClient } from './client.ts';
import { MARKER } from '../config.ts';

export interface ReviewInput {
  event: 'COMMENT' | 'REQUEST_CHANGES';
  body: string;
}

export async function submitReview(
  client: GithubClient,
  pr: { owner: string; repo: string; number: number },
  input: ReviewInput,
): Promise<void> {
  const body = input.body.includes(MARKER) ? input.body : `${MARKER}\n${input.body}`;
  await client.rest('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number,
    event: input.event,
    body,
  });
}

export async function dismissPriorReviews(
  client: GithubClient,
  pr: { owner: string; repo: string; number: number },
): Promise<void> {
  const { data } = await client.rest('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number,
    per_page: 100,
  });
  for (const review of data as any[]) {
    if (typeof review.body !== 'string' || !review.body.includes(MARKER)) continue;
    if (review.state === 'DISMISSED') continue;
    await client.rest(
      'PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals',
      {
        owner: pr.owner,
        repo: pr.repo,
        pull_number: pr.number,
        review_id: review.id,
        message: 'Superseded by a newer MVC assessment.',
      },
    );
  }
}
```

- [ ] **Step 3: Confirm pass**.

- [ ] **Step 4: Commit**

```bash
git add scripts/sustainability/assess-mvc/github/review.ts scripts/sustainability/assess-mvc/github/review.test.ts
git commit -m "Add review submit and prior-review dismissal"
```

### Task 3.3: Wire write side into CLI

**Files:**

- Modify: `scripts/sustainability/assess-mvc.ts` (replace empty `writes` stubs)
- Modify: `scripts/sustainability/assess-mvc.test.ts` (assert writes happen with `--no-dry-run` fake clients)

- [ ] **Step 1: Failing test**

Append:

```ts
it('with --no-dry-run, applies labels and submits a review', async () => {
  const log: any[] = [];
  const result = await runAssessment({
    coords: { owner: 'storybookjs', repo: 'storybook', number: 1 },
    flags: {
      dryRun: false,
      dismissPrevious: true,
      respectSkipRules: false,
      model: 'sonnet-4.6',
      effort: 'medium',
      verbose: false,
    },
    deps: {
      fetchPrContext: async () => ({
        owner: 'storybookjs',
        repo: 'storybook',
        number: 1,
        url: 'u',
        title: 't',
        body: '',
        author: 'a',
        isDraft: false,
        headSha: 'sha',
        labels: ['mvc:skip'],
        files: [],
        linkedIssues: [],
        brokenLinkRefs: [],
      }),
      duplicateLookup: async () => ({ crossRefs: [], timeline: [] }),
      isMaintainer: async () => false,
      llmJudge: async (id) => ({ id, status: 'pass', evidence: 'ok' }),
      synthesizeReview: async () => 'review body',
      writes: {
        addLabels: async (l) => log.push({ kind: 'add', l }),
        removeLabels: async (l) => log.push({ kind: 'remove', l }),
        submitReview: async (r) => log.push({ kind: 'review', r }),
        dismissPriorReviews: async () => log.push({ kind: 'dismiss' }),
      },
    },
  });
  expect(log.map((e) => e.kind)).toEqual(['dismiss', 'remove', 'add', 'review']);
  expect(log[1].l).toEqual(['mvc:skip']);
  expect(log[2].l).toEqual(['mvc:success']);
  expect(log[3].r.event).toBe('COMMENT');
});
```

- [ ] **Step 2: Replace `writes` stubs with real implementations**

Import the new modules in `assess-mvc.ts` and rebuild `buildDeps.writes`:

```ts
import { addLabels as ghAddLabels, removeLabels as ghRemoveLabels } from './assess-mvc/github/labels.ts';
import { submitReview as ghSubmitReview, dismissPriorReviews as ghDismissPriorReviews } from './assess-mvc/github/review.ts';

// in buildDeps, where the writes stub used to be:
writes: {
  async addLabels(labels) { await ghAddLabels(client, coords, labels); },
  async removeLabels(labels) { await ghRemoveLabels(client, coords, labels); },
  async submitReview(input) { await ghSubmitReview(client, coords, input); },
  async dismissPriorReviews() { await ghDismissPriorReviews(client, coords); },
},
```

Note: `coords` must be in scope. Refactor `buildDeps(client, flags)` → `buildDeps(client, flags, coords)`.

- [ ] **Step 3: Confirm tests pass**.

- [ ] **Step 4: Commit**

```bash
yarn fmt:write
git add scripts/sustainability/assess-mvc.ts scripts/sustainability/assess-mvc.test.ts
git commit -m "Wire label and review writes into CLI"
```

### Task 3.4: GitHub Actions workflow

**Files:**

- Create: `.github/workflows/mvc-assess.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/mvc-assess.yml
name: MVC Assessment

# Initial release: all triggers commented out. Uncomment after the
# agent-skill batch path has proven the workflow during the testing phase.
on: {}
# on:
#   workflow_dispatch:
#     inputs:
#       pr_number:
#         description: 'PR number to assess'
#         required: true
#   pull_request:
#     types: [labeled, synchronize]

concurrency:
  group: mvc-assess-${{ github.event.pull_request.number || github.event.inputs.pr_number }}
  cancel-in-progress: true

jobs:
  assess:
    if: |
      github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'pull_request' && github.event.action == 'labeled' && github.event.label.name == 'mvc:pending') ||
      (github.event_name == 'pull_request' && github.event.action == 'synchronize' && contains(github.event.pull_request.labels.*.name, 'mvc:failed'))
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - run: yarn install --immutable
        working-directory: ./scripts
      - env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          PR_NUMBER="${{ github.event.inputs.pr_number || github.event.pull_request.number }}"
          node scripts/sustainability/assess-mvc.ts "$PR_NUMBER" \
            --no-dry-run \
            --respect-skip-rules
```

- [ ] **Step 2: Validate YAML locally**

Run: `cd /home/steve/Development/storybook && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/mvc-assess.yml'))" && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/mvc-assess.yml
git commit -m "Add MVC assessment workflow (triggers commented out)"
```

### Task 3.5: Agent skill

**Files:**

- Create: `.agents/skills/assess-mvc/SKILL.md`

- [ ] **Step 1: Write the skill**

````markdown
---
name: assess-mvc
description: Assess a single PR against the MVC criteria, or batch-process eligible open PRs. Use when a maintainer asks for an MVC check, or for the periodic backlog sweep.
allowed-tools: Bash
---

# Assess MVC

Wraps `scripts/sustainability/assess-mvc.ts`. Two invocation modes.

## Single PR

A maintainer or agent asks you to assess a specific PR. Run:

```bash
GH_TOKEN=$(gh auth token) ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  node scripts/sustainability/assess-mvc.ts <pr-number-or-url> --no-dry-run
```
````

Notes:

- Skip rules are NOT applied here — the maintainer is asking for an assessment of this specific PR.
- The script prints a summary table + the review body it submitted, plus the labels added/removed.

## Batch (testing-phase backlog sweep)

While the workflow triggers are still commented out, you can sweep the open backlog manually:

1. Fetch eligible PRs:

   ```bash
   gh search prs --repo storybookjs/storybook \
     "is:pr is:open draft:no -label:mvc:success -label:mvc:failed -label:mvc:skip" \
     --json number --jq '.[].number' --limit 200
   ```

2. For each PR, run the script with skip rules enabled (so drafts, prior-verdict, maintainer authors all short-circuit):

   ```bash
   for pr in $(gh search prs ... ); do
     GH_TOKEN=$(gh auth token) ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
       node scripts/sustainability/assess-mvc.ts "$pr" --no-dry-run --respect-skip-rules
   done
   ```

3. Report PRs that returned `Deferred:` (no agent-scan label yet) — these should be retried after the agent-scan workflow lands.

## Troubleshooting

- Missing `GH_TOKEN`: the script exits 1 with the required scopes listed.
- LLM call fails: re-run with `-v` to see the prompt and response.
- A specific check is stuck: pass `--model opus-4.6 --effort high` to up the budget on hard cases.

````

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/assess-mvc/SKILL.md
git commit -m "Add assess-mvc agent skill"
````

### Task 3.6: Validation deliverable — test conditions list

**Files:**

- Create: `docs/superpowers/test-conditions/2026-06-11-mvc-assessment.md`

This satisfies spec section 12's validation-plan TODO. Lists every branch of every check + every CLI flag interaction to exercise against a `sidnioulz/storybook` mirror.

- [ ] **Step 1: Write the matrix**

```markdown
# MVC Assessment — Test Conditions

Derived from `docs/superpowers/specs/2026-06-10-mvc-assessment-script-design.md`.
Exercise each row against a `sidnioulz/storybook` (or equivalent) mirror with mock issues and PRs.

## Skip rules

| Condition                         | Expected                                       |
| --------------------------------- | ---------------------------------------------- |
| Draft PR + `--respect-skip-rules` | `Skipped: draft`; exit 0; no labels, no review |
| PR labeled `mvc:success`          | `Skipped: already-assessed`                    |
| PR labeled `mvc:failed`           | `Skipped: already-assessed`                    |
| PR labeled `mvc:skip`             | `Skipped: explicit-skip`                       |
| Maintainer-authored PR            | `Skipped: maintainer`                          |
| None of the above                 | runs assessment                                |

## Check 1 (human-monitored)

| Labels                    | Expected                               |
| ------------------------- | -------------------------------------- |
| `agent-scan:human`        | PASS                                   |
| `agent-scan:mixed`        | FAIL                                   |
| `agent-scan:automated`    | FAIL                                   |
| (no `agent-scan:*` label) | DEFERRED; exit 0; no labels, no review |

## Check 2 (real problem)

| Setup                                        | Expected                    |
| -------------------------------------------- | --------------------------- |
| No linked issue                              | FAIL                        |
| Linked issue closed                          | FAIL                        |
| LLM judges PR does not match                 | FAIL                        |
| LLM judges PR matches (bug)                  | PASS                        |
| LLM judges feature, fit=`none`               | FAIL                        |
| LLM judges feature, fit=`augments-api`       | PASS                        |
| Cross-repo linked issue in `storybookjs/csf` | resolved; assessed normally |
| Broken link (404)                            | warn, not fail              |

## Check 3 (duplicate)

| Setup                                          | Expected            |
| ---------------------------------------------- | ------------------- |
| No other PR references issue                   | PASS                |
| Another open PR references same issue          | FAIL (cite that PR) |
| Another merged PR + issue not reopened         | FAIL                |
| Another merged PR + issue closed-then-reopened | PASS                |
| Only closed-unmerged PRs reference issue       | PASS (silent)       |
| Same PR (self) appears in cross-refs           | ignored             |

## Check 4 (cost/benefit)

| Setup                                        | Expected                          |
| -------------------------------------------- | --------------------------------- |
| Net LOC ≤ 30, no new deps                    | PASS (short-circuit, no LLM call) |
| Large diff, broad issue (S1, many reactions) | LLM-PASS or WARN                  |
| Large diff, edge-case low-engagement issue   | LLM may FAIL                      |
| Added runtime dependency                     | LLM-judged                        |
| High cyclomatic hot-spot                     | LLM-judged                        |

## Check 5 (explains how to test)

| Setup                                         | Expected |
| --------------------------------------------- | -------- |
| Missing "Manual testing" section              | FAIL     |
| Author self-report only                       | FAIL     |
| Unit tests only, no user-facing steps         | FAIL     |
| Concrete reproducible steps                   | PASS     |
| Steps live in linked issue and read as recipe | PASS     |

## Check 6 (provides context)

| Setup                        | Expected             |
| ---------------------------- | -------------------- |
| Trivial diff (≤ 15 net LOC)  | PASS (short-circuit) |
| Substantive "Why" in PR body | LLM-PASS             |
| No rationale, complex diff   | LLM-FAIL             |

## CLI flag interactions

| Args                                   | Expected                                      |
| -------------------------------------- | --------------------------------------------- |
| `--dry-run` (default)                  | prints summary + body, no GitHub side effects |
| `--no-dry-run`                         | labels + review applied                       |
| `--no-dry-run --dismiss-previous`      | prior bot reviews dismissed before new one    |
| `--respect-skip-rules` + ineligible PR | skip path                                     |
| `--model opus-4.6 --effort high`       | passes through to LLM client                  |
| missing `GH_TOKEN` and `GITHUB_TOKEN`  | exit 1 with scopes message                    |

## Idempotency

| Sequence                                             | Expected                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Run twice with `--no-dry-run`, no PR changes between | second run: same verdict, label set unchanged, second review posted (no dismissal) |
| Run twice with `--no-dry-run --dismiss-previous`     | first review dismissed before second posted                                        |
| PR currently has `mvc:pending`                       | label is removed regardless of new verdict                                         |

## Early-abort

| Setup                 | Expected                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Check 1 FAIL          | LLM judges not invoked; review body lists `real-problem`, `cost-benefit`, `explains-test`, `provides-context` as "not performed" |
| Check 3 FAIL          | same                                                                                                                             |
| Both Check 1 + 3 PASS | LLM phase runs                                                                                                                   |
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/test-conditions/2026-06-11-mvc-assessment.md
git commit -m "Add test-conditions matrix for MVC assessment validation"
```

**Phase 3 checkpoint:** Tag `phase-3`. The script can run end-to-end against real PRs (manually invoked via the skill). The CI workflow is in place but inert. The validation deliverable is ready to drive mirror-based testing before flipping triggers on.

---

## Self-Review Notes

Use these as a quick checklist when reviewing the plan before executing:

- **Spec coverage:**
  - All six checks: Tasks 1.8 (human), 1.9 (duplicate), 2.2 (real-problem), 2.3 (cost-benefit), 2.4 (explains-test), 2.5 (provides-context).
  - Precomputes: 1.5–1.7.
  - Defer behavior: handled in `assess-mvc.ts` `main()` after `runAssessment`.
  - Early-abort: `isEarlyAbort` (Task 1.11) + `runAssessment` (Task 1.12) + integration test in Task 2.8.
  - Skip behavior (all four): Task 1.10.
  - Marker / dismissal: Tasks 3.2, 3.3.
  - Workflow + skill + test conditions: Tasks 3.4, 3.5, 3.6.
- **Open spec TODOs the plan defers (intentional):**
  - Canned-response copy (`canned-responses.ts` placeholders, Task 2.6).
  - Maintainer team slug confirmation (constant in `config.ts`; trigger flip-on follows).
  - Storybot app token swap (workflow uses `secrets.GH_TOKEN`; future PR replaces it).
  - One-mega-LLM-call vs 4-parallel — implementation uses 4 parallel + synthesis (the spec's baseline) and we leave the consolidation experiment for a follow-up if cost becomes a concern.
- **Type consistency check:** `CheckId`/`CheckStatus`/`CheckResult`/`Verdict`/`PrContext`/`LinkedIssue` defined once in `types.ts` and consumed everywhere.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-11-mvc-assessment-script.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task and review between tasks; fast iteration, isolated context per step.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`; batch execution with checkpoints (phase boundaries) for review.

Which approach?
