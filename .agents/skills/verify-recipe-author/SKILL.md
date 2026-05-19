---
name: verify-recipe-author
description: Generate the Playwright recipe spec for a PR-verify-pr-generate prompt bundle. Reads `.verify-output/<runId>/prompt-bundle.json`, dispatches the OMC executor agent (model=opus), and pipes the raw agent reply into `verify-pr-author` (stdin mode). The TypeScript core owns extraction, deny-regex, header-comment provenance, the file write to `.verify-recipes/pr-<#>.spec.ts`, scoped lint, the single retry, and `.verify-output/<runId>/result.json`. Trigger after `yarn verify-pr-generate`.
allowed-tools: Agent, Bash, Read, Write, Edit
---

# Verify Recipe Author

Consumes a prompt bundle emitted by `yarn verify-pr-generate --pr <#>` and produces the per-PR Playwright recipe spec for human review. Authoring only — never executes the spec.

This skill is invoked **after** `yarn verify-pr-generate --pr <#>` succeeds. The bun script does the deterministic I/O (gh fetch, triage, prompt assembly, bundle write); this skill **only** dispatches the agent and pipes its raw reply into the `verify-pr-author` CLI. Extraction, deny-regex, provenance, file write, lint, the single retry, and `result.json` all live in TypeScript core — the skill never does them itself.

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

- If the file exists and `bundle.force === false` → write `result.json` with `{ status: "collision", specPath: <path>, attempts: 0 }` and stop. (This mirrors the CLI's own `collision` status / exit 1; the pre-flight only exists to skip a wasted agent dispatch — the CLI re-enforces D9 regardless.)
- Otherwise proceed.

> **One owner.** After dispatch, the TypeScript core
> (`scripts/verify-pr-author.ts` → `scripts/verify/recipe-author-core.ts`)
> owns spec-body extraction, deny-regex, header-comment provenance, the
> file write, scoped lint, post-write regex checks, the single retry, and
> `result.json`. The skill does **not** extract fences, run deny-regex, or
> write the spec itself. Steps 3–5 below are the entire runbook.

### Step 3 — Dispatch the agent (attempt 1)

```
Agent({
  description: "Generate PR recipe spec",
  subagent_type: "oh-my-claudecode:executor",
  model: "opus",
  prompt: bundle.prompt
})
```

The bundle's `prompt` already contains the full authoring contract,
reference specs, PR diff, and fence-marker instruction
(`<<<SPEC_START>>>` … `<<<SPEC_END>>>`). Capture the agent's full raw
reply as `$REPLY` (do not parse or edit it).

### Step 4 — Pipe the raw reply to `verify-pr-author` (stdin mode)

```bash
printf '%s' "$REPLY" | node /Users/valentinpalkovic/Projects/storybook/scripts/verify-pr-author.ts --bundle <abs-bundle-path> --dispatch-mode stdin
```

The CLI performs extraction, deny-regex, provenance, file write, scoped
lint (`scripts/verify/lint-invocation.ts`), post-write regex checks, and
writes `result.json`. Exit codes:

- `0` — success. CLI wrote the spec and `result.json`. Go to Step 6.
- `75` — retryable failure (lint, post-write regex, **or a first
  deny-regex hit** — the CLI asks the agent to self-correct). The CLI
  emitted a framed retry block on stdout. Go to Step 5.
- `1` — terminal failure (collision, extract-failed, or any gate
  exhausted on the final attempt). CLI already wrote `result.json` with
  the failure status. Print the failure line (Step 6) and stop.

Exit 75 is the sole retry sentinel; any other non-zero exit is terminal.
The skill never decides retryability — the CLI does.

### Step 5 — Retry once (on exit 75)

Parse stdout for the framed retry block:

```
===VERIFY_PR_AUTHOR_RETRY_BEGIN===
<retryMessage payload — already categorized and capped at 5 errors>
===VERIFY_PR_AUTHOR_RETRY_END===
```

Assemble the retry prompt and re-dispatch the agent (same
`subagent_type` and `model`):

```
<bundle.prompt>

[RETRY]
<retryMessage>
```

Pipe the new raw reply back through the CLI in retry mode:

```bash
printf '%s' "$REPLY2" | node /Users/valentinpalkovic/Projects/storybook/scripts/verify-pr-author.ts --bundle <abs-bundle-path> --dispatch-mode stdin --retry-of <runId>
```

The CLI enforces `MAX_RECIPE_ATTEMPTS` (read from
`scripts/verify/recipe-author-core.ts`; currently 2) and will **not**
re-emit exit 75 on the retry call. Expected exits:

- `0` — success. Go to Step 6.
- `1` — terminal failure (any gate exhausted on attempt 2). CLI wrote
  `result.json` with `attempts: 2` and the terminal status. Print the
  failure line and stop.

### Step 6 — Print actionable next-step lines

`result.json` is already written by the CLI — do **not** write it from
the skill. On success print:

```
[verify-recipe-author] spec written: <abs spec path>
[verify-recipe-author] result.json: <abs result.json path>
[verify-recipe-author] attempts: <n>
[verify-recipe-author] Next: review the spec, then run `yarn verify-pr --recipe-spec <spec path>`
```

On a terminal exit-1, print instead:

```
[verify-recipe-author] FAILED: <status> — see <abs result.json path>
```

## Failure Modes

`result.json` is written by the CLI, not the skill. `status` is the exact
`RecipeAuthorStatus` union from `scripts/verify/recipe-author-core.ts` —
do not invent values. On attempt 1 in stdin mode, lint / post-write-regex
/ **first deny-regex hit** all return `retry-requested` (CLI exit 75) so
the agent can self-correct; the terminal status below is what lands when
attempts are exhausted (CLI exit 1).

| Cause | terminal `status` | Exit | Retried once first? |
|---|---|---|---|
| `outputSpecPath` exists and `force === false` | `collision` | 1 | no |
| No parseable body between fence markers | `extract-failed` | 1 | no (terminal immediately) |
| Deny-regex hit | `deny-regex-hit` | 1 | **yes** (attempt-1 → `retry-requested`/exit 75) |
| Scoped lint failed | `lint-failed` | 1 | yes (attempt-1 → `retry-requested`/exit 75) |
| Post-write regex check failed (listener-before-goto OR attach) | `regex-failed` | 1 | yes (attempt-1 → `retry-requested`/exit 75) |
| All gates pass | `spec-written` | 0 | n/a |

## Notes

- This skill runs inside Claude Code; it uses `Agent`, `Read`, `Write`, `Bash`, and `Edit` tools.
- All paths in invocations are absolute. Lint commands `cd code` via `yarn --cwd`.
- Max attempts = `MAX_RECIPE_ATTEMPTS` (currently 2). Read the value from `scripts/verify/recipe-author-core.ts` — do not hardcode.
- The skill **never executes** the generated spec. The human review gate (Phase-1 lethal-trifecta breaker) is preserved.
- A first deny-regex hit is retried **once** in stdin mode (the CLI emits `retry-requested` / exit 75 so the agent can self-correct, e.g. eval #36); only an exhausted deny hit is the terminal `deny-regex-hit`. The deny-regex remains a security gate — the single self-correction attempt does not weaken it (every attempt is re-checked; a persistent hit still terminates).
- Cap retry feedback at 5 errors (R3).
- The `runId` is the basename of the parent directory of the bundle; do not invent a new one.

## Phase-2 follow-up

This skill currently couples generation to a running Claude Code session via the `Agent` tool dispatch. Phase-2 CI activation will require migrating to a direct Anthropic SDK call (`@anthropic-ai/sdk`) with an `ANTHROPIC_API_KEY` env var, replacing the `Agent` dispatch with a standalone API call so the workflow at `.github/workflows/verify-pr.yml` can run unattended. Tracked as a follow-up in the plan's ADR §Follow-ups.
