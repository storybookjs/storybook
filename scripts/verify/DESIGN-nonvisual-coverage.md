# DESIGN — non-visual coverage (`@verify-mode` axis + changed-line coverage gate)

Companion to the shipped `.verify-scratch` blessing
(RecipePage.writeFixture / scratchDir).

## Implementation status

| Part | scope | status |
| ---- | ----- | ------ |
| A — `@verify-mode` parser | `scripts/verify/mode.ts` | **SHIPPED** |
| A — `mode` on `VerifyResult`, HMAC-signed | `core.ts` (`SIGNED_FIELDS`) | **SHIPPED** |
| B — orchestrator parse/log/stamp | `verify-pr.ts` | **SHIPPED** |
| B — `visual` / `behavioral` router | shared boot+Playwright; vision gated to `visual` in `verify-evidence-check.ts` | **SHIPPED** |
| B — `pure-fn` / `build-config` router | needs non-browser execution harness; emits explicit `skipped` (no false verdict) | **SEAM ONLY — not wired** |
| C — changed-line coverage gate | V8/vitest diff∩executed, `derive-verdict` AND clause | **DEFERRED** (not started) |
| `type-only` mode | — | **DROPPED** (owner decision: too close to rejected differential-only verification) |

`pure-fn` / `build-config` are recognized by the parser but the orchestrator
writes a `skipped` verdict with a note pointing here rather than misrouting
through the browser. Wiring them needs a focused-vitest / build-output
execution path **and** a generate/author-side change (the recipe artifact for
`pure-fn` is a vitest test, not a Playwright spec) — beyond a parser+router
slice.

## Problem

Last eval wave (16 fork PRs #22–#37): 7 verified / 9 regression, infra solid,
0 no-verdict. **All 5 residual false/weak verdicts are non-visual categories**:

| PR  | upstream | category   |
| --- | -------- | ---------- |
| #27 | 34753    | type-only  |
| #28 | 34752    | aria       |
| #29 | 34749    | aria       |
| #31 | 34712    | XSS / behavioral |
| #32 | 34703    | XSS / behavioral |

Vision (`verify-evidence-check.ts`) can only judge ~20% truly-visual PRs. For
the rest it returns `undetermined`, which today only triggers a retry, never a
real signal. There is **no objective check that the recipe actually exercised
the changed lines** — a recipe can navigate to an unrelated story, pass, and
the diff is never executed.

User constraint (LOCKED): real integration tests, **not** differential-only
verification. Vision stays for the visual minority.

## Part A — `@verify-mode` axis

A second header, parsed exactly like `@verify-target` (mirror
`scripts/verify/target.ts`; do **not** fold into it — orthogonal axes,
separate parsers keep the regex/validation isolated).

```
// @verify-target: internal-ui
// @verify-mode: behavioral
```

New file `scripts/verify/mode.ts`:

```ts
export type VerifyMode =
  | 'visual'        // screenshot/vision — current default behavior
  | 'behavioral'    // Playwright asserts DOM/ARIA/console-error-free/network
  | 'pure-fn'       // focused vitest importing the changed symbol
  | 'build-config'; // assert built output / config-effect, no screenshot
  // ('type-only' was considered and DROPPED — see status table.)

const DEFAULT_MODE: VerifyMode = 'visual';   // back-compat: existing recipes unchanged
const HEADER_RE = /^\s*\/\/\s*@verify-mode:\s*(\S+)\s*$/;
// same 30-line scan window, same throw-on-invalid contract as target.ts
export function parseModeFromSpec(specPath: string): VerifyMode { /* mirror target.ts */ }
```

Default `visual` ⇒ every existing recipe and the example keep current
behavior with zero edits (no migration).

### Who sets the mode

`verify-pr-generate.ts` already classifies the diff to build triage globs and
the target suggestion (`scripts/verify/target-suggest.ts`,
`scripts/verify/recipes/triage-table.ts`). Mode is selected by the
**recipe-author agent**, instructed via the prompt bundle, from a new triage
section in `_recipe-authoring-guide.md` (one HARD GATE rule per mode, same
shape as the existing §12 target-selection / nextjs-vs-nextjs-vite rules). The
agent emits the header into the spec; the orchestrator parses it back. This
reuses the existing author→header→parse loop — no new control channel.

## Part B — router strategy dispatch

`scripts/verify-pr.ts` (orchestrator) branches on `parseModeFromSpec()` after
the existing `parseTargetFromSpec()`:

| mode         | strategy                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------- |
| visual       | unchanged — Playwright + vision evidence-check (current path)                              |
| behavioral   | Playwright run; **skip vision**; verdict = assertions + console-error-free + coverage gate |
| pure-fn      | focused `vitest run` importing the changed symbol from `$PR_HEAD_DIR`; no browser          |
| build-config | run the affected build/compile, assert the config effect on output; no screenshot         |

- `behavioral` is the workhorse for the aria/XSS misses. The recipe writes any
  needed setup via `RecipePage.writeFixture()` (already shipped) so it can
  stand up the trigger state without srt friction.
- `pure-fn` needs **no Playwright** — the router short-circuits before
  browser launch. It still produces a signed `verify-result.json` through the
  same `verifyResultSignature` path (C1 HMAC unchanged).
- Vision (`verify-evidence-check.ts`) is invoked **only** for `mode === 'visual'`.
  For all other modes the useless `undetermined` is replaced by the coverage
  gate (Part C) as the objective signal.

## Part C — changed-line coverage gate

The objective "did the test execute the diff" signal. Replaces vision
`undetermined` for non-visual modes; an **AND** signal for `behavioral` /
`pure-fn` (not applicable to pure `build-config`).

Mechanism:

1. `verify-pr-generate.ts` already produces the PR diff
   (`$RUNNER_TEMP/pr.diff`). Derive the changed-line map (file → added line
   numbers) from it — reuse the diff already parsed for triage globs.
2. Collect coverage during the recipe run:
   - Playwright modes: V8 coverage via `playwright.config.ts` (Chromium CDP
     `Profiler`/`coverage` API), scoped to `code/**` source under
     `$PR_HEAD_DIR`.
   - vitest (`pure-fn`): vitest `--coverage` (V8 provider, already available).
3. New `scripts/verify/ci/coverage-gate.ts`: intersect executed lines with the
   changed-line map. Emit `coverage` block into `verify-result.json`:

   ```jsonc
   { "coverage": { "changedLines": 42, "executedChangedLines": 39, "ratio": 0.93, "threshold": 0.5 } }
   ```

4. `derive-verdict.ts` gains a third AND clause (same shape as the existing
   unit-tests downgrade at lines 140–148): `verified` + coverage mode active +
   `ratio < threshold` ⇒ downgrade to `regression` with reason
   `"recipe did not execute the changed lines (ratio=… < …)"`. Threshold
   starts conservative (0.5) and is tuned against the #22–#37 eval set.

This is **not** differential verification — the recipe is a real integration
test asserting behavior; coverage is only a guard that the assertion path
touched the diff, killing the "passes by navigating elsewhere" false-verify.

## Integration points (files touched)

| file | change |
| ---- | ------ |
| `scripts/verify/mode.ts` (new) | `@verify-mode` parser, mirrors `target.ts` |
| `scripts/verify-pr.ts` | router branch on mode; skip-vision / skip-browser paths |
| `scripts/verify/playwright.config.ts` | enable V8 coverage collection (Playwright modes) |
| `scripts/verify/ci/coverage-gate.ts` (new) | diff∩executed intersection, writes `coverage` block |
| `scripts/verify/ci/derive-verdict.ts` | third AND clause: low-coverage downgrade |
| `scripts/verify-evidence-check.ts` | gate vision invocation on `mode === 'visual'` |
| `.github/workflows/verify-pr.yml` | coverage-gate step; mode-aware compile/vitest dispatch (the spec is already grepped for `@verify-target` at L207–224 — add a parallel `@verify-mode` grep) |
| `.verify-recipes/_recipe-authoring-guide.md` | per-mode HARD GATE triage section + worked example per non-visual mode |

## Open questions / validation

- Coverage threshold: tune on #22–#37 (label-toggle re-run). Start 0.5.
- Type-change PRs (e.g. #27/34753): with `type-only` dropped, these route to
  `behavioral` (import + use the changed type at runtime so a type break
  surfaces as a runtime/compile failure) or fall back to default `visual`.
  Open: confirm `behavioral` is sufficient for pure type-contract diffs, or
  design an alternative that is a real test (not differential `tsc`).
- V8 coverage scoping under srt: Chromium CDP coverage stays in-process; no new
  egress, no srt change. Confirm the profiler artifact lands in an allowWrite
  path (`$PR_HEAD_DIR/.verify-output`).

## Validation plan

Same as prior waves: fork PR label-toggle on the existing eval set #22–#37.
Success = the 5 non-visual misses (#27/#28/#29/#31/#32) flip to correct
verdicts with no regression in the 7 already-passing visual PRs.
