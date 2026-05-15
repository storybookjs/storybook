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

### Step 8 — Pipe to `verify-pr-author` (D4-α sentinel-exit-75 contract)

Lint, deny-regex, post-write regex checks, header-comment provenance, retry-message
authoring, and result.json emission all live in TypeScript core. The skill's job is
strictly to dispatch the agent and pipe its raw reply into the author CLI.

#### 8a. Dispatch the agent (attempt 1)

```
Agent({
  description: "Generate PR recipe spec",
  subagent_type: "oh-my-claudecode:executor",
  model: "opus",
  prompt: bundle.prompt
})
```

Capture the agent's full reply as `<reply>`.

#### 8b. Pipe to `verify-pr-author --bundle <bundle-path> --dispatch-mode stdin`

```bash
printf '%s' "$REPLY" | node /Users/valentinpalkovic/Projects/storybook/scripts/verify-pr-author.ts --bundle <abs-bundle-path> --dispatch-mode stdin
```

The CLI runs the deny-regex, header-comment provenance, file write, scoped lint
(`scripts/verify/lint-invocation.ts`), and post-write regex checks. Exit codes:

- `0` — success. CLI has already written the spec and `result.json`. Skip to Step 10.
- `1` — non-retryable error (deny-regex hit, collision, IO error). CLI has written
  `result.json` with the failure status. Print the failure line and stop.
- `75` — retryable lint/structural failure. The CLI has emitted a framed retry
  block on stdout (see Step 9). Continue to Step 9.

Treat **exit 75** as the sole retry sentinel. Any other non-zero exit is terminal.

### Step 9 — Retry once (attempt 2, sentinel-exit-75)

On exit 75 from Step 8b, parse stdout for the framed retry block:

```
===VERIFY_PR_AUTHOR_RETRY_BEGIN===
<retryMessage payload — already categorized and capped at 5 errors>
===VERIFY_PR_AUTHOR_RETRY_END===
```

Extract the lines strictly between the BEGIN/END markers and assemble the retry
prompt as:

```
<bundle.prompt>

[RETRY]
<retryMessage>
```

Dispatch the agent again with the assembled retry prompt (same `subagent_type` and
`model`). Capture the new reply as `<reply2>`, then pipe it back through the CLI in
retry mode:

```bash
printf '%s' "$REPLY2" | node /Users/valentinpalkovic/Projects/storybook/scripts/verify-pr-author.ts --bundle <abs-bundle-path> --dispatch-mode stdin --retry-of <runId>
```

The CLI enforces `RECIPE_RETRY_POLICY.maxAttempts` (currently 2) — it will not
re-emit exit 75 on the retry call. Expected exits:

- `0` — success. Skip to Step 10.
- `1` — terminal failure (lint exhausted, regex-check exhausted, deny-regex hit).
  CLI has written `result.json` with `attempts: 2` and the failure status. Print
  the failure line and stop.

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
- Max attempts = `MAX_RECIPE_ATTEMPTS` (currently 2). Read the value from `scripts/verify/recipe-author-core.ts` — do not hardcode.
- The skill **never executes** the generated spec. The human review gate (Phase-1 lethal-trifecta breaker) is preserved.
- Deny-regex hits are not retried — they are security signals, not lint nits.
- Cap retry feedback at 5 errors (R3).
- The `runId` is the basename of the parent directory of the bundle; do not invent a new one.

## Phase-2 follow-up

This skill currently couples generation to a running Claude Code session via the `Agent` tool dispatch. Phase-2 CI activation will require migrating to a direct Anthropic SDK call (`@anthropic-ai/sdk`) with an `ANTHROPIC_API_KEY` env var, replacing the `Agent` dispatch with a standalone API call so the workflow at `.github/workflows/verify-pr.yml` can run unattended. Tracked as a follow-up in the plan's ADR §Follow-ups.
