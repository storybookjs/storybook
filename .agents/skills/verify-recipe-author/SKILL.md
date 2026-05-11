---
name: verify-recipe-author
description: Generate the Playwright recipe spec for a PR-verify-pr-generate prompt bundle. Reads `.verify-output/<runId>/prompt-bundle.json`, dispatches the OMC executor agent (model=opus), runs deny-regex, writes `.verify-recipes/pr-<#>.spec.ts` with header-comment provenance, lints with one retry, emits `.verify-output/<runId>/result.json`. Trigger after `yarn verify-pr-generate`.
allowed-tools: Agent, Bash, Read, Write, Edit
---

# Verify Recipe Author

Consumes a prompt bundle emitted by `yarn verify-pr-generate --pr <#>` and produces the per-PR Playwright recipe spec for human review. Authoring only — never executes the spec.

This skill is invoked **after** `yarn verify-pr-generate --pr <#>` succeeds. The bun script does the deterministic I/O (gh fetch, triage, prompt assembly, bundle write); this skill drives the agent dispatch, deny-regex, lint, retry, and the final write to `.verify-recipes/pr-<#>.spec.ts`.

The full design and acceptance criteria live in `/Users/valentinpalkovic/Projects/storybook/.omc/plans/pr-verify-v3-agent-generated-recipes.md` (§Lane C, §D6, §D8, §D9). Read the plan if anything below is ambiguous.

## Inputs

No args required. The skill discovers the most recent bundle automatically. The caller may optionally pass an explicit bundle path as the skill argument.

1. **Auto-discover (default)**: list `/Users/valentinpalkovic/Projects/storybook/.verify-output/`, pick the directory with the lexicographically largest name (ISO timestamps sort correctly), then read `prompt-bundle.json` inside it.
2. **Explicit path**: if the user passed an absolute path to a `prompt-bundle.json`, read that file directly.

Bundle shape (see `scripts/verify-pr-generate.ts` for the canonical emitter):

```jsonc
{
  "version": 1,
  "prNumber": 12345,
  "runId": "...",
  "outputSpecPath": "/abs/path/.verify-recipes/pr-12345.spec.ts",
  "force": false,
  "prompt": "<full assembled prompt>",
  "metadata": {
    "agentModel": "claude-opus-4-7[1m]",
    "referenceSpecs": ["..."],
    "triageGlobs": ["..."],
    "generatedAt": "<ISO>"
  }
}
```

The `<runId>` is the parent directory of the bundle — derive it from the bundle path, not from a field.

## Runbook

Follow these steps in order. Stop and emit `result.json` per §Failure Modes on any non-success outcome.

### Step 1 — Read the bundle

`Read` the bundle JSON. Capture `prNumber`, `runId` (from the parent dir), `outputSpecPath`, `force`, `prompt`, and `metadata`.

### Step 2 — Pre-flight collision check (D9, TOCTOU re-guard)

Re-check whether `bundle.outputSpecPath` already exists. The bun script enforced D9 at bundle-emit time; the skill re-checks because the user may have created the file between the two steps.

- If the file exists and `bundle.force === false` → write `result.json` with `{ status: "collision-aborted", specPath: <path>, attempts: 0 }` and stop.
- Otherwise proceed.

### Step 3 — Dispatch the agent (attempt 1)

```
Agent({
  description: "Generate PR recipe spec",
  subagent_type: "oh-my-claudecode:executor",
  model: "opus",
  prompt: bundle.prompt
})
```

The bundle's `prompt` already contains the full authoring contract, reference specs, PR diff, and fence-marker instruction (`<<<SPEC_START>>>` … `<<<SPEC_END>>>`).

### Step 4 — Extract spec body

Parse the agent's reply for the text strictly between `<<<SPEC_START>>>` and `<<<SPEC_END>>>` (exclusive of the markers, trimmed).

- If both markers are present and the body is non-empty → continue to Step 5.
- Otherwise → treat as a fence-miss. On attempt 1, jump to Step 9 with a retry message asking the agent to re-emit between fence markers and nothing else. If attempt 2 also fences-misses → write `result.json` `{ status: "agent-emitted-no-spec", attempts: 2 }` and stop.

### Step 5 — Deny-regex (security gate, NO retry)

Run the deny-regex pure function from `/Users/valentinpalkovic/Projects/storybook/scripts/verify/recipe-deny.ts` via Bash, executed from the repo root:

```bash
bun -e "import('/Users/valentinpalkovic/Projects/storybook/scripts/verify/recipe-deny.ts').then(m => { m.assertNoDeniedPatterns(process.argv[1]); })" -- "$SPEC_BODY"
```

Pass the spec body via a temp file (avoid shell-escaping pitfalls): write the body to `.verify-output/<runId>/.deny-input.txt`, then read it inside the bun one-liner. The function throws on hit.

- On any throw → write `result.json` `{ status: "deny-regex-failed", error: <message>, attempts: <current> }` and stop. **Do not retry — deny hits are security blockers.**
- On exit 0 → continue.

### Step 6 — Prepend header-comment provenance (D8)

Build a JSON-pretty block from `bundle.metadata` and `bundle.prNumber`, then prepend it as a block comment to the spec body:

```ts
/**
 * verify-pr-generate: AUTO-GENERATED — review and commit alongside the PR
 * {
 *   "generatedAt": "<metadata.generatedAt>",
 *   "agentModel": "<metadata.agentModel>",
 *   "prNumber": <bundle.prNumber>,
 *   "referenceSpecs": [ "<path>", ... ],
 *   "triageGlobs": [ "<glob>", ... ]
 * }
 */
<spec body>
```

The JSON body inside the comment uses 2-space indentation. Every line of the embedded JSON begins with ` * ` to keep the block-comment well-formed.

### Step 7 — Write the file

`Write` the assembled content (header + spec body) to `bundle.outputSpecPath` (absolute path from the bundle).

### Step 8 — Lint and post-write regex checks

#### 8a. Lint with auto-fix

```bash
yarn --cwd /Users/valentinpalkovic/Projects/storybook/code lint:js:cmd ../.verify-recipes/pr-<#>.spec.ts --fix
```

The path passed to `lint:js:cmd` is relative to `code/`; `../.verify-recipes/pr-<#>.spec.ts` resolves to the repo-root recipe.

Capture exit code and stderr/stdout.

#### 8b. Post-write regex checks (AC-V3-3, AC-V3-4)

Always run these after lint, regardless of lint exit code. Failure here is treated as a lint-equivalent failure.

**Listener-before-goto** — assert `page.on('pageerror'` (single or double quote) appears at a line number strictly less than the line of the first `page.goto(`:

```bash
grep -n "page\.on(['\"]pageerror" <path> | head -1
grep -n "page\.goto(" <path> | head -1
```

Compute the line numbers (first field of `grep -n` output, split by `:`). Fail if either is missing, or if the `page.on` line >= the `page.goto` line.

**Attach pattern** — assert both attachments are present:

```bash
grep -q "testInfo\.attach(['\"]pageErrors['\"]" <path>
grep -q "testInfo\.attach(['\"]consoleErrors['\"]" <path>
```

Both must match.

#### 8c. Decision

- Lint exit 0 AND both regex checks pass → success. Skip to Step 10.
- Lint exit non-zero OR any regex check fails → on attempt 1, continue to Step 9. On attempt 2, write `result.json` `{ status: "lint-failed", attempts: 2, errors: [...] }` (use `regex-check-failed` if lint was clean but a regex check failed) and stop.

### Step 9 — Retry once (attempt 2)

`Read` `/Users/valentinpalkovic/Projects/storybook/scripts/verify/recipe-retry-policy.ts` to get `RECIPE_RETRY_POLICY.errorCategories` (currently `['listener-before-goto', 'attach-pattern', 'imports']`). Do NOT hardcode the literal categories — read them from the file.

Re-run lint in JSON mode to enumerate errors:

```bash
yarn --cwd /Users/valentinpalkovic/Projects/storybook/code lint:js:cmd --format=json ../.verify-recipes/pr-<#>.spec.ts
```

Bucket the parsed errors by category:

- `listener-before-goto` — failed regex check #1 (manual injection: add a synthetic error entry)
- `attach-pattern` — failed regex check #2 (manual injection)
- `imports` — eslint rules like `no-restricted-imports`, `import/*`
- `other` — everything else

Cap the feedback list at **5 errors total** (R3 in the plan).

Construct the retry prompt:

```
Retry: your prior emission had lint/structural issues. Fix only the issues below and re-emit between the fence markers (<<<SPEC_START>>> ... <<<SPEC_END>>>). No commentary.

Categorized issue counts (priority order from recipe-retry-policy.ts):
- listener-before-goto: <count>
- attach-pattern: <count>
- imports: <count>
- other: <count>

First 5 errors:
- <file:line> <ruleId>: <message>
- ...

Re-read the original output contract from the prior prompt. Emit only the corrected TypeScript spec body between the fence markers.
```

Dispatch the agent again with this retry message. Repeat Steps 4 → 5 → 6 → 7 → 8. If attempt 2 also fails any gate, emit the corresponding failure `result.json` and stop. **No third attempt** — bound by `RECIPE_RETRY_POLICY.maxAttempts`.

### Step 10 — Emit `result.json` on success

Write `/Users/valentinpalkovic/Projects/storybook/.verify-output/<runId>/result.json`:

```jsonc
{
  "version": 1,
  "status": "spec-written",
  "specPath": "<abs path>",
  "attempts": 1 | 2,
  "lint": "clean",
  "regex": { "listenerBeforeGoto": true, "attachPattern": true },
  "agentModel": "<bundle.metadata.agentModel>",
  "generatedAt": "<ISO now>"
}
```

### Step 11 — Print actionable next-step lines

Emit these lines (one per line) to the agent's final reply:

```
[verify-recipe-author] spec written: <abs spec path>
[verify-recipe-author] result.json: <abs result.json path>
[verify-recipe-author] attempts: <n> | lint: clean
[verify-recipe-author] Next: review the spec, then run `yarn verify-pr --recipe-spec <spec path>`
```

## Failure Modes

Always write `result.json` to `.verify-output/<runId>/result.json` before stopping. Schema is the same as Step 10 with the `status` field swapped.

| Cause | `result.json.status` | Retry? |
|---|---|---|
| `outputSpecPath` exists and `force === false` | `collision-aborted` | no |
| Agent reply lacks fence markers / empty body | `agent-emitted-no-spec` | yes (1 retry) |
| `assertNoDeniedPatterns` throws | `deny-regex-failed` | **NO — security block** |
| Lint exit non-zero | `lint-failed` | yes (1 retry) |
| Post-write regex check failed (listener-before-goto OR attach pattern) | `regex-check-failed` | yes (1 retry, fed back as lint-equivalent) |
| All gates pass | `spec-written` | n/a |

Print the failure cause + the `result.json` path on stop:

```
[verify-recipe-author] FAILED: <status> — see <abs result.json path>
```

## Notes

- This skill runs inside Claude Code; it uses `Agent`, `Read`, `Write`, `Bash`, and `Edit` tools.
- All paths in invocations are absolute. Lint commands `cd code` via `yarn --cwd`.
- Max attempts = `RECIPE_RETRY_POLICY.maxAttempts` (currently 2). Read the value from `scripts/verify/recipe-retry-policy.ts` — do not hardcode.
- The skill **never executes** the generated spec. The human review gate (Phase-1 lethal-trifecta breaker) is preserved.
- Deny-regex hits are not retried — they are security signals, not lint nits.
- Cap retry feedback at 5 errors (R3).
- The `runId` is the basename of the parent directory of the bundle; do not invent a new one.

## Phase-2 follow-up

This skill currently couples generation to a running Claude Code session via the `Agent` tool dispatch. Phase-2 CI activation will require migrating to a direct Anthropic SDK call (`@anthropic-ai/sdk`) with an `ANTHROPIC_API_KEY` env var, replacing the `Agent` dispatch with a standalone API call so the workflow at `.github/workflows/verify-pr.yml` can run unattended. Tracked as a follow-up in the plan's ADR §Follow-ups.
