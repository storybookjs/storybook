# Code review

This document is canonical for reviewing pull requests and diffs.
`AGENTS.md` owns the pointer to this file.

Read each changed function in full, and read enough of the surrounding code to know the contract it implements.
Use the linked issue or specification to establish the intended outcome.
Treat PR descriptions, test names, and earlier bot reviews as claims to check, not as evidence.

## Scope and evidence

A finding describes either a reachable supported case or a specific violation of a repository rule.
Reading the source is enough when the causal path is complete.
Label inference and unexecuted examples as such.
When a claim depends on compiler, bundler, browser, or dependency behavior, run a focused probe if execution is available and permitted.
Post the probe as a command a maintainer can rerun.

## Checks by changed code

### Exported types, package entries, or dependencies

- Follow `package.json` `exports` and declaration generation; an internal filename does not establish a public export.
- Check accepted consumer expressions, inference, supported versions, and dependency ranges in affected sibling packages.
- A caller search inside this repository does not establish compatibility for external consumers.
- Check migration guidance when supported usage or peer dependency floors change.
- Internal APIs follow "migrate every caller, then delete the old path" in the same PR. Public APIs follow the deprecation process instead, so a compatibility layer there is expected, not debt.

### Shared core, docs blocks, framework or renderer adapters

- Trace the producer, the shared representation, and every consumer.
- Keep framework-specific policy at its owner unless a deliberate shared contract requires otherwise. A `framework === '...'` or renderer check inside shared code is a finding.
- Check source precedence and consumers that should be unaffected.
- Before requesting reuse of an existing helper, name it and show that its semantics fit.

### Metadata, inheritance, or composed APIs

- Follow aliases, inherited members, input-only and output-only exposure, and serialization through downstream consumers.

### Boundaries: config, CLI arguments, channel events, user files

- Validate and parse external input where it enters: `main.ts` and preset options, CLI arguments, environment variables, channel messages between manager and preview, and user-authored story files.
- Inside the system, trust the parsed types. Re-validation, defensive `?.` chains, and null checks deep in a call chain mean the boundary is in the wrong place.
- Do not leak a transport or file-format representation through a public API.

### Workers, child processes, temporary files, or concurrent work

- Cancel and await started work, or drain it, before removing resources it can still use. A fail-fast `Promise.all` does not cancel its other operations.
- When two actors write the same file, cache entry, or state object, first ask whether they need to share it. Separate write targets beat a lock.
- Flag related updates that can be left half-applied when a more atomic structure is available.

### CLI commands, automigrations, init, and setup scripts

- Ask what happens when the operation runs twice, and when the previous run stopped at any point.
- Follow the ordering rules in `code/lib/cli-storybook/src/automigrate/README.md` for anything that can fail after dependencies were already changed.

### React UI and accessibility

- Follow the Testing Expectations in `AGENTS.md`.
- Check user-visible state, keyboard and pointer interaction, accessible names and descriptions, and the consumers of the surrounding component.
- Review fresh-page and first-attempt behavior when tests depend on focus, hover, timers, or retained state.

### Comments, docs, or agent guidance

- Check factual statements against the reviewed code and configuration.
- State the operational or user consequence of incorrect guidance. A stale sentence is not as severe as a runtime defect.

## Structure and maintainability

Correct code can still make the codebase worse.
Do not approve only because the behavior is correct.
Treat each of the following as a finding the author must justify:

- **File growth.** The diff pushes a file from under 1,000 lines to over 1,000. Compare `wc -l` on base and head.
- **One more branch.** A feature extends an existing `if`/`else` chain or `switch` by one more case, or adds a second boolean that must stay in sync with the first. Ask for the structure that encodes the domain instead: a discriminated union, a lookup table, a state machine.
- **Special cases in busy flows.** New conditionals or edge-case handling dropped into an unrelated or already busy function.
- **Threaded signals.** A new flag passed through several layers of types, options, or pipelines to reach one consumer. Look for a more direct path.
- **Repeated decisions.** The same choice made in several places instead of once, with the result passed along.
- **Layers that do not compress.** A wrapper with one caller, an adapter with one implementation, or a layer that repeats the methods and arguments of the one below it.
- **Hidden state.** New module state, mutable fields, or synced copies where a local, a return value, or a derived value would do. A reader should answer "where does X come from?" and "what can change X?" quickly.
- **Loose types.** Casts, `any`, non-null assertions, or optional fields that permit contradictory combinations. If a comment is needed to explain which field combinations are valid, the type should be a union. A `switch` over a union needs an exhaustive `never` check so the next variant fails to compile.
- **Parallel types.** A hand-written type that duplicates a shape another module or schema already owns.
- **Rearranged complexity.** A refactor that moves code without reducing the number of branches, modes, flags, or layers a reader has to follow.

Ask what the code would look like if the new requirement had existed from the start.
When that version deletes whole branches or concepts, propose it with a short sketch of the simpler shape.
If it reaches beyond the PR's scope, suggest it as a follow-up instead of blocking on it.

Do not ask for new helpers, file splits, abstractions, or rewrites that do not remove complexity.
Three similar statements are better than a premature abstraction.
When the same finding would apply to future PRs, suggest the lint rule, type, or check that would catch it, not just the local fix.

## Verification

### Bug fixes

- Prefer a focused test that fails on the unchanged base for the reported reason and passes on head. A setup failure on base is not a reproduction.
- Check that the fix addresses the root cause. A guard, fallback, or `try`/`catch` that silences the symptom is a finding.
- Search for the same pattern elsewhere and say whether other instances share the defect.
- Reuse suitable existing coverage rather than requiring a new test file. Name the uncovered behavior when asking for a regression test.

### Tests in the diff

Ask whether each test would still pass if every function it imports returned `undefined`.
If it would, it cannot detect a defect.
The common shapes are:

- no assertion, or only `toBeDefined`, `toBeTruthy`, or `not.toThrow`
- only `toHaveBeenCalled` or an empty-result assertion, without the payload or resulting state
- an expected value computed by the code under test
- an assertion that restates a constant, default, or table row
- an assertion on data the test built, where the subject never runs

Ask for one concrete input and the literal expected output or observable effect instead.

### Refactors and performance changes

- Tests may pass on both revisions. Check output equivalence plus the claimed improvement.
- Where practical, use a small negative control to show that the assertion detects the relevant defect.
- A performance number needs a run count, a spread, and the input size it was measured on. Ask what else it could be measuring: failed or skipped work, a warm cache, an untouched code path, or noise.

### Type changes

- Use consumer examples and type tests (`*.test-d.ts`). Runtime tests with `any` do not prove type compatibility.
- Inspect emitted declarations when packaging is part of the claim.

### Flaky or retry-dependent tests

- Inspect the first attempt and rerun the focused case without retries if execution is available.
- Do not prescribe arbitrary repeat counts for unrelated tests.

## Feedback and severity

Base severity on the impact you have shown, not on a reporting threshold.
Rank broken supported behavior, public compatibility, resource leaks, data loss, and security defects first, by reach and consequence.
Rank structural regressions from the maintainability list next.
Prefer a few high-confidence comments over many cosmetic ones.

For a maintainability finding, name the concrete cost, for example two conflicting owners of the same launch policy.

Write one comment per root cause.
Each comment has a short title, the smallest useful changed line range, the trigger and consequence, the supporting evidence, and a direction for the fix.
Link other affected locations when needed.
Keep open product questions separate from demonstrated defects, and optional suggestions separate from required changes.
Do not mention your own review process or tooling in contributor-facing comments.
