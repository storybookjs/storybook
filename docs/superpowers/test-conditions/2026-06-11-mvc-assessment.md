# MVC Assessment — Test Conditions

**Branch:** `sidnioulz/mvc-script-and-skill`
**Script:** `scripts/sustainability/assess-mvc.ts`
**Workflow:** `.github/workflows/mvc-assess.yml` (triggers inert by default)
**Skill:** `.agents/skills/assess-mvc/SKILL.md`

Validation matrix to exercise against a mirror of `storybookjs/storybook`
(e.g. `sidnioulz/storybook-mirror`) before enabling the `pull_request_target`
triggers in the workflow. Each row is a setup + expected output. Run in
`--dry-run` first to verify behavior, then `--no-dry-run` to confirm the
side effects.

## Argument & token validation (no remote calls)

| Setup | Command | Expected |
|---|---|---|
| Missing PR arg | `node scripts/sustainability/assess-mvc.ts` | exit non-zero, `missing required argument` |
| Garbage arg | `node scripts/sustainability/assess-mvc.ts not-a-pr` | exit 1, parse error mentioning "PR" |
| Non-storybookjs URL | `node scripts/sustainability/assess-mvc.ts https://github.com/example/foo/pull/1` | exit 1, error mentions "storybookjs" |
| Invalid `--model` choice | `… 12345 --model not-a-model` | exit non-zero, commander rejects |
| Invalid `--effort` choice | `… 12345 --effort extreme` | exit non-zero, commander rejects |
| No token | `unset GH_TOKEN GITHUB_TOKEN; … 12345` | exit 1, error names scopes |

## Skip rules

Tested against a mirror PR; assertions on stdout + label state.

| Setup | Flags | Expected |
|---|---|---|
| Open PR labeled `mvc:success` | (defaults) | `Skipped: already-assessed`; exit 0 |
| Open PR labeled `mvc:failed` | (defaults) | `Skipped: already-assessed` |
| Open PR labeled `mvc:success` | `--reassess` | proceeds with assessment |
| Open PR labeled `mvc:failed` | `--reassess` | proceeds; new verdict overwrites the label |
| Draft PR | (defaults) | `Skipped: draft` |
| Draft PR | `--force` | proceeds with assessment |
| PR labeled `mvc:skip` | (defaults) | `Skipped: explicit-skip` |
| PR labeled `mvc:skip` | `--force` | proceeds |
| Maintainer-authored PR (author in `core` / `dx` / `maintainers` team) | (defaults) | `Skipped: maintainer` |
| Maintainer-authored PR | `--force` | proceeds |
| Eligible community PR | (defaults) | `Eligible for assessment` |
| Eligible community PR | `--force` | `Eligible for assessment (--force; skip rules bypassed)` |

## Check 1 — Human-monitored

PR labels drive the verdict; no I/O.

| Labels | Expected `Check 1` |
|---|---|
| `agent-scan:human` | PASS |
| `agent-scan:human-operated-agent` | WARN; guidance mentions maintainer override |
| `agent-scan:human` + `agent-scan:automated` | PASS (PASS beats FAIL) |
| `agent-scan:automated` + `agent-scan:human-operated-agent` | WARN (WARN beats FAIL) |
| `agent-scan:mixed` | FAIL; guidance contains agentscan/discord URLs |
| `agent-scan:automated` | FAIL |
| (no `agent-scan:*` label) | DEFERRED; CLI exits 0 with `Deferred: …`; no labels, no review |

## Check 2 — Real problem

Deterministic gates run before any LLM call.

| Setup | Expected |
|---|---|
| No linked issue | FAIL; no LLM call |
| Linked issue closed (only) | FAIL; no LLM call |
| Open linked issue + LLM judges substantive match | PASS |
| Open linked issue + LLM judges no match | FAIL |
| Feature-category PR, `featureFit: 'none'` | FAIL; guidance suggests addon ecosystem |
| Feature-category PR, `featureFit: 'augments-api'` (or any non-`none`) | PASS |
| Open linked issue + broken `brokenLinkRefs[]` | WARN (not FAIL); evidence lists broken refs |
| PR body has `<!-- example: closes #1000 -->` only | Behaves as if no linked issue (HTML comment stripped at fetch) |

## Check 3 — Not a duplicate

PR-number ordering matters. Mirror needs PRs at known numbers.

| Setup | Expected |
|---|---|
| No linked issues | PASS (`duplicate check is moot`) |
| No other PR references any linked issue | PASS |
| Older open PR (lower number) references same issue | FAIL; evidence cites "predates this PR" |
| Newer open PR (higher number) references same issue | PASS (first-PR-wins) |
| Merged PR references same issue, issue never reopened | FAIL |
| Merged PR references same issue, issue closed-then-reopened | PASS |
| Only closed-unmerged PRs reference the issue | PASS (silent) |
| The PR-under-review itself appears in cross-refs | ignored |

## Check 4 — Cost / benefit

Short-circuits for trivial diffs; otherwise calls LLM with precomputes.

| Setup | Expected |
|---|---|
| Net LOC ≤ 30, no new deps | PASS (no LLM call) |
| Net LOC > 30 + LLM PASS | PASS |
| Net LOC > 30 + LLM WARN | WARN |
| Net LOC > 30 + LLM FAIL | FAIL; guidance suggests narrowing or addon |
| Added runtime dep + LLM judgement | passes the dep name into the LLM prompt |
| Severity label on issue (`sev:S1`–`sev:S4`) | surfaces in prompt as the severity signal |
| Reactions on issue (+1, -1, tada) | surface in prompt |

## Check 5 — Explains how to test

LLM-judged with the cleaned PR body (HTML comments stripped).

| Setup | Expected |
|---|---|
| Missing "Manual testing" section | FAIL |
| Author self-report ("I tested locally") | FAIL |
| Unit-test invocation only, no user-facing steps | FAIL |
| Concrete reproducible CLI/UI steps | PASS |
| Steps live in the linked issue body | LLM may PASS (acceptable as fallback) |

## Check 6 — Provides context

Always invokes the LLM (no LOC short-circuit — small diffs in central files can still need rationale).

| Setup | Expected |
|---|---|
| Substantive "Why" in PR body | PASS |
| No rationale, complex diff | FAIL; guidance asks for a Why section |
| Tiny diff, no rationale, but PR is well-aligned with the linked issue | LLM may PASS (rationale "self-evident") |
| Flag flip in a central file, no rationale | FAIL (small diff but high impact) |

## Synthesis & verdict

| Setup | Expected |
|---|---|
| All deterministic + LLM PASS | Verdict PASS; review body via `judgeText` (markdown) |
| Any check FAIL | Verdict FAIL |
| Check 1 or Check 3 FAIL | `earlyAbort: true`; LLM checks stub to DEFERRED; review body lists not-performed checks |
| LLM returns invalid JSON for a check | `judge` throws; assessment fails with a clear error |
| LLM wraps `judgeText` output in fences | output preserved; reviewer sees the fences |

## Linked-issue source tracking

| Body | API `closingIssuesReferences` returns | Expected `sources` |
|---|---|---|
| `Fixes #42` | `[#42]` | `['api']` (GitHub parses it) — body scan also matches; if both `['api', 'body']` |
| `See #50 for context` | `[]` | `['body']` |
| `Closes storybookjs/csf#7` | `[#7]` | `['api', 'body']` |
| `<!-- example: #1000 -->` | `[]` | (empty — body comments are stripped) |
| Body refs a 404-ing issue number | `[]` | issue goes to `broken[]`, not `issues[]` |

## Writes (`--no-dry-run`)

Side effects observable via the GitHub UI / API on the mirror.

| Setup | Expected |
|---|---|
| Verdict PASS, no `mvc:*` label set | label `mvc:success` added; review event = `COMMENT` |
| Verdict FAIL, no `mvc:*` label set | label `mvc:failed` added; review event = `REQUEST_CHANGES` |
| Verdict PASS, prior `mvc:failed` label present | `mvc:failed` removed, `mvc:success` added |
| Any verdict, prior `mvc:pending` label present | `mvc:pending` removed (not part of our managed verdict set) |
| `--dismiss-previous` + prior bot reviews | prior reviews matching the `<!-- mvc-check:v1 -->` marker dismissed |
| `--dismiss-previous` + no prior bot reviews | no-op |
| Submitted review body contains the marker | yes (synthesis prepends it) |

## Idempotency

| Sequence | Expected |
|---|---|
| Run with `--no-dry-run`, then run again immediately (without `--reassess`) | second run hits `Skipped: already-assessed` |
| Same as above with `--reassess` | second run posts a fresh review; same verdict, label set unchanged |
| `--no-dry-run --dismiss-previous` twice | each run dismisses prior bot reviews before posting |

## CLI output

Verifiable visually but worth checking on the mirror:

- Intro line: `MVC Assessment — #<number>` with the cyan badge.
- Per-step spinners collapse to checkmark lines on success.
- PR-level info logged immediately after `Fetched:` (URL, status, file count, head SHA, labels, diff, new deps).
- Linked issues each printed with `[source]` tag and state.
- Each check inline with `✓` PASS / `✗` FAIL / `▲` WARN / `◐` DEFERRED.
- Final `Verdict: PASS` or `Verdict: FAIL (early-abort)`.

## Workflow (after flipping triggers)

| Trigger | Job condition expected to match |
|---|---|
| Manual `workflow_dispatch` with `pr_number=N` | always |
| `pull_request_target` action=`labeled` label=`mvc:pending` | matches |
| `pull_request_target` action=`labeled` label=`mvc:failed` | does NOT match |
| `pull_request_target` action=`synchronize` PR has `mvc:failed` | matches, runs with `--reassess` |
| `pull_request_target` action=`synchronize` PR has no `mvc:failed` | does NOT match |
| Workflow run on a fork PR | checks out the trusted base SHA, never the fork head |

## Out of scope for this matrix

- Approval flow (phase-2 aggregator that APPROVES when both `mvc:success` and
  `verification:success` are present).
- Verification of PR correctness (`verification:*` workflows).
- PR completion (adding tests, stories, docs — separate finalization agent).
- Semantic duplicate detection across all open PRs.
- Media (screenshot/video) evaluation.
