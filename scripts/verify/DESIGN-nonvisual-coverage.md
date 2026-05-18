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

## Eval outcome — 2026-05-18 (fork next 8900f3c → 8870a68, 7 commits)

Critical precondition fixed first: the eval `try-pr-*` branches were polluted
(base ≠ harness baseline → every diff = harness footprint + version skew, the
real change buried). Rebuilt all 16 = fork `next` + only the real PR
commit(s); fork `next` advanced so `pull_request_target` runs the new code.

7 fixes shipped + validated (each via targeted fork re-trigger):

1. `8900f3c` @verify-mode axis + behavioral router + vision-skip gate +
   `.verify-scratch` RecipePage API — #32/#37 verified behaviorally.
2. `651659d` deny-regex hits retryable (mirror lint path) + §12.5 HARD GATE
   "never import()/monkeypatch the changed module" — #36/#31 self-corrected
   past deny-regex.
3. `4a95771` `@typescript-eslint/no-explicit-any: off` (non-security; was
   no-verdict cause for manager-api recipes) + §12.5 `as any` note —
   #31 no-verdict → verdict.
4. `e356453` §12 triage: additive-only-API-with-no-consumer (the #1
   false-regression cause) + Brand custom-HTML (`image:null` path) +
   ActionBar docs-vs-component scope — #28/#29 regression → **verified**.
5. `9a72d34` `previewRoot()` `:has(> *)` not `:visible` (fullscreen /
   side-by-side stories have a zero-box root) + unit-test TMPDIR.
6. `62a0e83` srt sandbox tmp comes from `CLAUDE_CODE_TMPDIR` (not TMPDIR);
   `env -i` stripped it so srt fell back to a never-created `/tmp/claude`
   → Yarn `mktempPromise` ENOENT → false "no JSON report". Pass it through.
   + Brand rule bans `expect(#storybook-root).toBeVisible()`.
7. `8870a68` `filterConsoleErrors()` for srt-egress `net::ERR_*` noise +
   MANDATORY guide rule (mirror filterPageErrors).

Scorecard (original 5 non-visual misses): **#27, #28, #29, #32 → verified**
(4/5 flipped). #31 Playwright recipe now passes; residual regression is the
PR's own `Brand.test.tsx` failing 1/N — the three-signal verdict correctly
gating, real-vs-flake is a per-PR question, not a harness defect.

#36 (try-pr-34649, a11yRunner) residual: a pure-logic, no-UI-surface change
whose PR unit test genuinely fails 1/N → regression is the **correct**
verdict. Recipe-author keeps hand-rolling weak Playwright instead of the
§12.5 visual-smoke fallback for no-UI-path changes. Not pursued further:
fighting a correct regression. Future: strengthen §12.5 routing so
no-UI-surface changes deterministically pick visual-smoke, and/or wire
`pure-fn` mode (still unwired — emits `skipped`).

All harness mechanism / infra root causes are resolved. Remaining gaps are
recipe-author *quality* (selector/strategy choice), not the
mode/deny/lint/tmp/console mechanisms. Next decisive measurement: a full
16-PR wave with all 7 fixes for an aggregate verified/regression number vs
the polluted-baseline.
