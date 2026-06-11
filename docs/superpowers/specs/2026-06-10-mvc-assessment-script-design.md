# MVC Assessment Script — Design

**Date:** 2026-06-10
**Status:** Approved for implementation planning
**Repo:** `storybookjs/storybook`

## 1. Purpose

Storybook receives 5–15 community PRs per day, mostly from AI accounts. Reviewing every PR to maintainer standards is not sustainable. We need a first-pass automation that detects whether a PR is a **Minimum Viable Contribution (MVC)** — the smallest unit of work worth a human maintainer's time — and either coaches the author toward MVC status or blocks the PR until it qualifies.

This script is the **first automated entry point** for community PRs. It runs before any other agent-driven review (verification, completion, finalization) and before human maintainer attention.

## 2. Scope

### In scope

- A Node.js CLI script that assesses a single PR (by number or URL) against six MVC criteria.
- Deterministic data collection + LLM-assisted judgment.
- Submission of a formal PR review (COMMENT on PASS, REQUEST_CHANGES on FAIL) with tailored, constructive feedback.
- Application of `mvc:success` or `mvc:failed` labels; removal of stale `mvc:*` labels.
- A GitHub Actions workflow that wraps the CLI (triggers initially commented out).
- An agent skill that wraps the CLI for batch processing and manual single-PR runs.

### Out of scope (v1)

- Approving PRs (a separate phase-2 workflow will APPROVE when both `mvc:success` and `verification:success` are present).
- Verification of PR correctness (separate verification:\* workflow).
- PR completion (adding tests, stories, docs — separate finalization agent).
- Semantic duplicate detection across all open PRs.
- Media (screenshot/video) evaluation.

## 3. Architecture

### Flow

```
parse args → check token → resolve PR
    ↓
deterministic phase (always runs)
  - fetch PR metadata, body, diff, labels, author
  - fetch linked issues (cross-repo within storybookjs/*)
  - compute precomputes (LOC, files, cyclomatic, deps)
  - run Check 1 (human-monitored)
  - run Check 3 (duplicate)
    ↓
gate: any deterministic check FAILed?
    ├── yes → skip LLM phase, compose review from deterministic findings only
    └── no  → continue to LLM phase
    ↓
LLM phase (parallel)
  - Check 2 (real problem)
  - Check 4 (cost/benefit)
  - Check 5 (explains how to test)
  - Check 6 (provides context)
    ↓
synthesis call
  - compose review body from all check results + canned response library
    ↓
emit output
  - always print summary table + composed review to stdout
  - if --no-dry-run: submit review, update labels, optionally dismiss prior reviews
```

### File layout

```
scripts/sustainability/
  assess-mvc.ts                    # CLI entry point
  assess-mvc/
    checks/
      human-monitored.ts           # Check 1 (deterministic)
      real-problem.ts              # Check 2 (LLM)
      duplicate.ts                 # Check 3 (deterministic)
      cost-benefit.ts              # Check 4 (LLM + precomputes)
      explains-how-to-test.ts      # Check 5 (LLM)
      provides-context.ts          # Check 6 (LLM)
    precomputes/
      diff-metrics.ts              # LOC, files
      cyclomatic.ts                # AST walker over changed JS/TS
      dependencies.ts              # package.json diff
    github/
      client.ts                    # octokit wrapper
      pr.ts                        # PR fetch + linked issues
      labels.ts                    # label add/remove
      review.ts                    # review submit + dismiss
    llm/
      client.ts                    # claude-agent-sdk wrapper
      synthesis.ts                 # final review composition
    canned-responses.ts            # criterion + overall response templates
    types.ts                       # CheckResult, AssessmentResult, etc.
    output.ts                      # dry-run summary table + review preview
```

## 4. CLI Interface

Built on `commander` (already in `scripts/package.json`, supports `--no-foo` flags natively).

```
node scripts/sustainability/assess-mvc.ts <pr> [options]

<pr>                                 PR number (e.g. 12345) or full URL
                                     (https://github.com/storybookjs/storybook/pull/12345)

Options:
  --dry-run / --no-dry-run           Default: --dry-run.
                                     Dry-run prints what would be done; never modifies GitHub.
  --dismiss-previous /               Default: --no-dismiss-previous.
    --no-dismiss-previous            Dismiss prior mvc-check reviews from this bot
                                     before posting a new one.
  --respect-skip-rules /             Default: --no-respect-skip-rules.
    --no-respect-skip-rules          When on, skip ineligible PRs (drafts,
                                     maintainer-authored, already labeled mvc:success/
                                     mvc:failed, labeled mvc:skip) and exit 0.
  --model <name>                     Claude model. Default: sonnet-4.6.
                                     Valid: sonnet-4.6 | opus-4.6 | haiku-4.5.
  --effort <level>                   Reasoning effort. Default: medium.
                                     Valid: low | medium | high | max.
  -v, --verbose                      Print LLM input/output for debugging.
  -h, --help                         Show help and exit.
```

### Exit codes

- `0` — assessment completed (PASS or FAIL — both fine), or skipped under `--respect-skip-rules`, or deferred (e.g., agent-scan label not yet present).
- `1` — usage error, missing token, PR not found.
- `2` — GitHub API error during write (only possible with `--no-dry-run`).

### Skip behavior (with `--respect-skip-rules`)

The script exits 0 and prints `Skipped: <reason>` for:

- Draft PRs.
- PRs already labeled `mvc:success` or `mvc:failed`.
- PRs labeled `mvc:skip`.
- PRs authored by members of the maintainer/core/DX teams (resolved via GitHub team membership API at runtime).

### Defer behavior

The script exits 0 and prints `Deferred: <reason>` when Check 1 returns "agent-scan not yet computed". No labels, no review. Subsequent triggers (e.g., `labeled` or `synchronize` events) retry.

## 5. Token / Auth

Before any other work, the script verifies `GH_TOKEN` or `GITHUB_TOKEN` is present in the environment. Missing token → exit 1 with a message listing required scopes (TODO: final copy in section 12).

Required scopes (fine-grained PAT or app token):

- **Pull requests: Read & Write** — fetch PRs, submit reviews.
- **Issues: Read & Write** — fetch linked issues, edit labels.
- **Contents: Read** — fetch diff content.
- **Members: Read** (org-level) — resolve maintainer team membership for skip rules.

Classic PAT equivalent: `repo` + `read:org`.

## 6. MVC Checks

Each check returns a `CheckResult`:

```ts
type CheckStatus = 'pass' | 'fail' | 'warn' | 'deferred';

interface CheckResult {
  id:
    | 'human'
    | 'real-problem'
    | 'duplicate'
    | 'cost-benefit'
    | 'explains-test'
    | 'provides-context';
  status: CheckStatus;
  evidence: string; // short factual summary, for the review body
  guidance?: string; // canned-response-derived feedback for the author, on fail/warn
}
```

**Overall verdict rule:** `FAIL` if any check returns `fail`; `PASS` otherwise. `warn` does not gate but is surfaced in the review.

**Phase ordering:** deterministic phase always runs (Checks 1 and 3, plus all precomputes). If any deterministic check FAILs, the LLM phase is skipped. The review body explicitly lists which LLM-judged checks were NOT performed so the author knows what other criteria they must satisfy.

### Check 1 — Human-monitored

**Type:** Deterministic.

| `agent-scan:*` label   | Verdict                                 |
| ---------------------- | --------------------------------------- |
| `agent-scan:human`     | PASS                                    |
| `agent-scan:mixed`     | FAIL (treated as automated)             |
| `agent-scan:automated` | FAIL                                    |
| (none)                 | DEFERRED — exit 0, no labels, no review |

The deferred case is common because the agent-scan workflow and this workflow can race on new PRs. CI retries via `labeled` or `synchronize` events when agent-scan eventually lands.

### Check 2 — Fixes a real problem / non-controversial feature

**Type:** LLM judgment.

#### Classification

The PR's category is classified before judgment:

1. PR's own category label (`bug`, `feature request`, `maintenance`, `build`, `cleanup`, `documentation`, `dependencies`, `other`) if present.
2. Linked issue's category labels.
3. If neither yields a category, LLM classifies from title + diff.

#### Linked-issue resolution

Linked issues are gathered from:

- GraphQL `closingIssuesReferences` (covers same-repo `Fixes #NNN` and cross-repo `org/repo#NNN`).
- PR body parsing for `storybookjs/REPO#NNN` references, full issue URLs, and same-repo `#NNN` mentions.

De-duplicate; resolve each via `GET /repos/{owner}/{repo}/issues/{n}`. Accept only issues in `storybookjs/*` repos. If an issue is unreachable (404, archived), surface as `warn` (not `fail`) — a broken link should not be punished as no link.

#### Rubric (uniform across all categories)

- **PASS**: linked issue exists AND is open AND LLM judges that the PR substantively addresses the linked issue (not tangential, not a side concern, not a different problem).
- **FAIL**: no linked issue, OR linked issue is closed, OR LLM judges the fix/feature does not match the issue.

The same bar applies to bug fixes, features, cleanup, dependencies, docs, etc. PRs from maintainer/core/DX teams are skipped upstream (`--respect-skip-rules`), so this rule never applies to small internal cleanups.

**Feature sub-rule:** For PRs classified as features, the LLM additionally judges whether the feature matches one of the three accepted categories:

1. Augments an existing API for addon/framework authors.
2. Adds support for popular / trending tech.
3. Quality-of-life improvement.

If the feature fits none of these, FAIL with guidance pointing the contributor toward the addon ecosystem.

### Check 3 — Not a duplicate

**Type:** Deterministic. Can FAIL — participates in early-abort.

For each linked issue (from Check 2's resolution), find other PRs that reference it via GraphQL `IssueTimelineItems` with `cross-referenced` events.

| Situation                                                                      | Verdict                     |
| ------------------------------------------------------------------------------ | --------------------------- |
| Another **open** PR on the same linked issue                                   | FAIL                        |
| Another **merged** PR on the same linked issue, issue NOT closed-then-reopened | FAIL                        |
| Another **merged** PR on the same linked issue, issue WAS closed-then-reopened | PASS                        |
| Another **closed-unmerged** PR on the same linked issue                        | PASS (silent, not surfaced) |
| No dupes found                                                                 | PASS                        |

**Closed-then-reopened detection:** Inspect the issue's timeline (`GET /repos/{o}/{r}/issues/{n}/timeline`) for at least one `closed` event followed by a `reopened` event, with current state open (Check 2 already requires open). This signals the prior merged fix did not hold; a new attempt is warranted.

FAIL message includes the offending PR number so the author knows which to follow.

### Check 4 — Cost / benefit ratio

**Type:** LLM judgment grounded in precomputes.

#### Cost precomputes (deterministic)

| Signal                                           | Source                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| LOC added, removed, net                          | PR files API                                                               |
| Files changed (count + paths)                    | PR files API                                                               |
| Cyclomatic complexity per changed JS/TS function | AST walker (TypeScript compiler API — already in repo via csf-tools)       |
| New runtime dependencies                         | `package.json` diff (added entries in `dependencies` / `peerDependencies`) |

**Dropped from v1:** cross-package edges (concern: noisy/poorly computed), test coverage signal (deferred to a separate completion agent), legacy-area path heuristics.

#### Benefit precomputes (deterministic + LLM)

| Signal                                       | Source                           |
| -------------------------------------------- | -------------------------------- |
| `sev:S1`–`sev:S4` label on linked issue      | Already fetched for Check 2      |
| 👍 / 👎 / 🎉 reaction counts on linked issue | GitHub reactions API             |
| Comment count on linked issue                | Issue API                        |
| Breadth vs edge-case classification          | LLM judgment (not deterministic) |

#### Rubric

LLM weighs cost against benefit with these explicit rules:

- **Edge cases warrant a stricter maintenance ceiling than broad issues.**
- **PASS** for proportionate or trivial changes. Default to PASS for small changes.
- **WARN** when concerns exist but the benefit may justify them. Default to WARN when uncertain.
- **FAIL** only on clear cost/benefit mismatch (e.g., edge-case low-engagement issue + large diff with high complexity).

LLM prompt is explicitly biased toward leniency: "FAIL requires clear evidence; default to WARN; default to PASS for small changes."

WARN status surfaces concerns to human reviewers without blocking. FAIL message constructively suggests paths forward (e.g., split the PR, focus on the core issue, consider an addon).

### Check 5 — Explains how to test (happy path)

**Type:** LLM judgment.

#### Sources

- PR body's "Manual testing" section (and any equivalent testing-instructions sections).
- Linked issue body (acceptable as fallback if it reads as a verification recipe).
- PR diff (to assess whether instructions actually exercise the change).

#### Rubric

**PASS** when:

- PR body has concrete steps, OR linked issue's content reads as a valid verification recipe (LLM judges).
- **Reproducibility framing**: steps tell a third-party how to validate the PR works — NOT the author's self-report ("I tested it locally").
- **User-action framing**: steps are real-world user actions (CLI commands, UI navigation, project setup) demonstrating the issue is fixed — NOT unit-test invocations decoupled from user-facing behavior.

**FAIL** when:

- Section is missing, empty, or essentially placeholder text.
- Instructions are author-centric self-reports.
- Instructions are only unit tests with no user-facing validation.
- Instructions don't match what the diff actually changes.

Media (screenshots/videos) is **out of scope** for Check 5. LLMs cannot reliably evaluate whether a screenshot proves the fix, and we explicitly want to avoid making demands humans must judge.

### Check 6 — Provides context & justification

**Type:** LLM judgment.

#### Sources

- PR body.
- PR diff.
- Linked issue body.

#### Rubric

**PASS** when:

- PR body has any explanation of WHY the author chose their approach, OR
- LLM judges the PR is simple enough / well-aligned enough with the linked issue that "why" is self-evident from the diff and issue alone.

**FAIL** when:

- No "why" in the body AND the "why" is not self-evident from the PR + issue.

Low bar — the goal is to surface PRs where a reviewer would have to guess at the author's intent, not to demand essays for trivial fixes. Tiny / one-line / obviously-trivial PRs auto-PASS via the "self-evident" branch.

#### Boundary against Check 5

- Check 5 = "how a reviewer can verify the fix works" (third-party reproducible recipe).
- Check 6 = "why the author chose this approach" (rationale, alternatives, validation thinking).
- "What checks the author performed to validate" lives in Check 6 (rationale for confidence).
- "Steps for the reviewer to reproduce and validate" lives in Check 5.

## 7. LLM Integration

- **SDK:** `@anthropic-ai/claude-agent-sdk` (already in `scripts/package.json`).
- **Default model:** `sonnet-4.6`.
- **Default effort:** `medium`.

### Call structure (v1 baseline)

The v1 baseline is **4 parallel judgment calls + 1 synthesis call** (5 calls per fully-assessed PR; 0 calls on early-abort):

1. Check 2 — real-problem judgment.
2. Check 4 — cost/benefit judgment.
3. Check 5 — testing-instructions judgment.
4. Check 6 — context judgment.
5. Synthesis — compose final review body from all check results + canned response library.

Each judgment call uses structured output (JSON schema) — no tools, no agentic loops. Synthesis call uses structured output with a `reviewBody: string` field.

### Canned responses

- Live in `scripts/sustainability/assess-mvc/canned-responses.ts`.
- One constant per criterion + one set of overall-verdict templates (pass / fail).
- Vision-doc canned responses transcribed verbatim into placeholders; positive-frame rewrites and overall-verdict templates are part of the TODO list.

The synthesis prompt instructs the LLM to **start from the matching canned response and tailor it** (add PR-specific specifics, drop irrelevant sentences) — never to invent new wording from scratch.

### Cost estimate (rough)

Per assessed PR with sonnet-4.6 / medium effort:

- ~10k input tokens × 5 calls = ~50k input tokens
- ~2k output tokens × 5 calls = ~10k output tokens
- Estimated $0.10–$0.30 per PR.

Backfill of 150 open PRs ≈ $15–$45. Ongoing 5–15 PRs/day ≈ $0.50–$4.50/day.

## 8. GitHub Interactions

### Reads (always)

- `GET /repos/{o}/{r}/pulls/{n}` — PR metadata, body, head SHA.
- `GET /repos/{o}/{r}/pulls/{n}/files` — diff (paginated).
- GraphQL `closingIssuesReferences` — linked issues.
- `GET /repos/{o}/{r}/issues/{n}` (per linked issue, possibly cross-repo within `storybookjs/*`) — issue body, state, labels.
- `GET /repos/{o}/{r}/issues/{n}/timeline` (per linked issue) — for dupe detection and closed-then-reopened detection.
- `GET /repos/{o}/{r}/issues/{n}/reactions` (per linked issue) — for Check 4 benefit signal.
- `GET /orgs/storybookjs/teams/{team}/memberships/{user}` (under `--respect-skip-rules`) — maintainer team membership.

### Writes (only with `--no-dry-run`)

- `POST /repos/{o}/{r}/pulls/{n}/reviews` — submit review (event: `COMMENT` on PASS, `REQUEST_CHANGES` on FAIL). Body marked with HTML comment `<!-- mvc-check:v1 -->` for identification by future tooling.
- `PUT /repos/{o}/{r}/pulls/{n}/reviews/{id}/dismissals` — only when `--dismiss-previous` is set. Dismisses prior bot reviews matching the marker.
- `POST /repos/{o}/{r}/issues/{n}/labels` — add `mvc:success` or `mvc:failed`.
- `DELETE /repos/{o}/{r}/issues/{n}/labels/{label}` — remove any of `mvc:success`, `mvc:failed`, `mvc:skip`, `mvc:pending` that are present and don't match the new verdict.

## 9. Output Format

Printed to stdout in both `--dry-run` and `--no-dry-run` modes. In `--no-dry-run`, it acts as a transcript of what was applied.

Styled with `picocolors` (matches `eval.ts` conventions).

```
MVC Assessment — #12345 "Fix vite externals"
Author: @somebody  |  Verdict: FAIL  |  Failed: 2, Warnings: 1

| Criterion              | Status   | Evidence                                              |
|------------------------|----------|-------------------------------------------------------|
| Human-monitored        | PASS     | agent-scan:human                                      |
| Real problem           | FAIL     | No linked issue; body lacks user-impact description   |
| Not duplicate          | PASS     | No other PRs reference linked issues                  |
| Cost/benefit           | WARN     | +482 LOC, complex changes; edge-case issue            |
| Explains how to test   | FAIL     | Manual testing section is empty                       |
| Provides context       | PASS     | "What I did" substantive                              |

[dry-run] Review (REQUEST_CHANGES):
─────────────────────────────────────
<rendered body, including which checks were NOT performed if early-aborted>
─────────────────────────────────────

[dry-run] Labels:
  remove: mvc:skip
  add:    mvc:failed
```

On early-abort (deterministic FAIL), the review body explicitly enumerates which LLM checks were NOT performed and tells the author "we'll evaluate these after the failing items above are addressed".

## 10. Re-run / Idempotency

- **Labels:** always remove any of `mvc:success`, `mvc:failed`, `mvc:skip`, `mvc:pending` that are present and don't match the new verdict. Apply exactly one of `mvc:success` / `mvc:failed`. The `mvc:pending` label is not part of our managed verdict set — we never apply it ourselves — but if it's present (e.g., a maintainer added it to trigger a re-assessment via the workflow), we clear it as part of the cleanup so the PR's label state reflects only the current verdict.
- **Reviews:** by default each run posts a fresh review; latest state from the bot wins the merge gate. With `--dismiss-previous`, prior bot reviews are dismissed before the new one is posted.
- The HTML comment marker `<!-- mvc-check:v1 -->` lets us identify our own reviews for the dismissal path and for future tooling.

## 11. Packaging

### CI workflow

File: `.github/workflows/mvc-assess.yml`.

```yaml
name: MVC Assessment

# Initial release: all triggers commented out. Uncomment after the
# agent-skill batch path has proven the workflow during the testing phase.
on:
  # workflow_dispatch:
  #   inputs:
  #     pr_number:
  #       description: 'PR number to assess'
  #       required: true
  # pull_request:
  #   types: [labeled, synchronize]

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
          GH_TOKEN: ${{ secrets.GH_TOKEN }} # Storybot app token swap planned later
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          PR_NUMBER="${{ github.event.inputs.pr_number || github.event.pull_request.number }}"
          node scripts/sustainability/assess-mvc.ts "$PR_NUMBER" \
            --no-dry-run \
            --respect-skip-rules
```

Note on the `mvc:pending` reference above: even though we don't manage `mvc:pending` as a state label, it's the natural name for a "please re-assess" trigger label that a maintainer can apply manually. The workflow listens for it but the script clears it on each run if present (already in the remove-set per section 10).

### Agent skill

File: `.agents/skills/assess-mvc/SKILL.md`.

Frontmatter style matches existing `.agents/skills/pr/SKILL.md` and `.agents/skills/github-qa-labels/SKILL.md`.

Two invocation modes documented in the skill body:

1. **Single PR**: `node scripts/sustainability/assess-mvc.ts <PR> --no-dry-run`. No skip rules. Used when a maintainer or agent wants to assess a specific PR.
2. **Batch (during testing phase)**: fetch eligible PRs with the GitHub search query

   ```
   is:pr is:open draft:no
   -label:mvc:success -label:mvc:failed -label:mvc:skip
   ```

   then for each PR invoke `node scripts/sustainability/assess-mvc.ts <PR> --no-dry-run --respect-skip-rules`. The script handles per-PR eligibility (drafts, maintainer authors).

## 12. TODO

### Copy (post-spec, with author review)

- [ ] Missing-token error message (final wording).
- [ ] Review body template (wrapping around LLM-tailored content).
- [ ] Dry-run output headings and labels.
- [ ] HTML comment marker text (final wording).
- [ ] LLM synthesis prompt voice/tone instructions.
- [ ] Per-criterion canned responses: vision-doc verbatim text + positive-frame rewrites side-by-side + "skew risk" annotation per template (flag where canned text might over-constrain the LLM and reduce tailoring quality).
- [ ] Overall-verdict canned responses (pass / fail), tuned to the constructive-positive frame ("our automation has identified ways to improve" not "you failed").

### Open decisions

- [ ] LLM call structure: one mega-call vs 4 parallel + synthesis. Research whether high context overlap makes one call cheaper. Validate before implementation.
- [ ] Cyclomatic complexity tool choice: minimal TypeScript-compiler-API walker (preferred — reuses csf-tools infra) vs `typhonjs-escomplex` vs `ts-complex`. Decide during implementation.
- [ ] Maintainer team list: identify the exact GitHub team slugs under `storybookjs` org to query (likely `core`, `dx`, `maintainers` — confirm with org admin view).

### Validation plan

- [ ] At the end of implementation, generate a complete list of test conditions from this design doc.
- [ ] Set up a mirror of storybook at `github.com/sidnioulz/storybook` (or similar) for safe automation testing.
- [ ] Create mock issues and PRs in the mirror to exercise each branch of every check:
  - PASS / FAIL paths for each of the 6 checks.
  - Defer behavior (no agent-scan label).
  - Early-abort behavior (Check 1 or 3 fails before LLM phase).
  - Skip behavior (all four skip reasons).
  - Re-run idempotency (labels and reviews).
  - Cross-repo linked issues (e.g., issue in `storybookjs-mirror/web`).
  - Closed-then-reopened linked issues.
- [ ] Run the script in `--dry-run` against the mirror first, then `--no-dry-run`, and verify all GitHub side effects.

### Out of v1 (future work)

- Phase-2 aggregator that submits APPROVE when both `mvc:success` and `verification:success` are present.
- Storybot GitHub App token swap (replacing `secrets.GH_TOKEN`).
- Semantic duplicate detection across all open PRs (LLM-based).
- Daily batch sweep as CI safety net (decided to defer until skill batch mode has run for some weeks).
