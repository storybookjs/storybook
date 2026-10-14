# Code review

## Scope and evidence

When a claim depends on compiler, bundler, browser, or dependency behavior, run a focused probe if execution is available and permitted.
Include a command a maintainer can rerun with the finding.

## Checks by changed code

### Exported types, package entries, or dependencies

- Follow `package.json` `exports` and declaration generation; an internal filename does not establish a public export.
- Check accepted consumer expressions, inference, supported versions, and dependency ranges in affected sibling packages.
- A caller search inside this repository does not establish compatibility for external consumers.
- Check migration guidance when supported usage or peer dependency floors change.
- Internal APIs follow "migrate every caller, then delete the old path" in the same PR. Public APIs follow the deprecation process instead, so a compatibility layer there is expected, not debt.

### Shared core, docs blocks, framework or renderer adapters

- Keep framework-specific policy at its owner unless a deliberate shared contract requires otherwise. Check any `framework === '...'` or renderer branch added to shared code for an ownership mistake.
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

- Follow [Testing](./testing.md).
- Check keyboard and pointer interaction, accessible names and descriptions, and the consumers of the surrounding component.
- Review fresh-page and first-attempt behavior when tests depend on focus, hover, timers, or retained state.

## Structure and maintainability

Check whether these changes add complexity without serving the new behavior. Report a finding when you can name the concrete cost:

- **One more branch.** A feature extends a chain of cases that would be simpler as a discriminated union, lookup table, or state machine, or adds a second boolean that must stay in sync with the first.
- **Special cases in busy flows.** New conditionals or edge-case handling dropped into an unrelated or already busy function.
- **Threaded signals.** A new flag passed through several layers of types, options, or pipelines to reach one consumer. Look for a more direct path.
- **Repeated decisions.** The same choice made in several places instead of once, with the result passed along.
- **Layers that do not compress.** A wrapper or adapter that only repeats the methods and arguments of the layer below it.
- **Hidden state.** New module state, mutable fields, or synced copies where a local, a return value, or a derived value would do. A reader should answer "where does X come from?" and "what can change X?" quickly.
- **Loose types.** Casts or `any` that hide incompatible shapes, or optional fields that allow contradictory combinations. Use a union when only certain combinations are valid; check that a new variant cannot silently fall through a `switch`.
- **Parallel types.** A hand-written type that duplicates a shape another module or schema already owns.

## Verification

Read [Testing](./testing.md) when reviewing tests in the diff.

### Bug fixes

- Prefer a focused test that fails on the unchanged base for the reported reason and passes on head. A setup failure on base is not a reproduction.

### Performance changes

- A performance number needs a run count, a spread, and the input size it was measured on. Ask what else it could be measuring: failed or skipped work, a warm cache, an untouched code path, or noise.

### Type changes

- Use consumer examples and type tests (`*.test-d.ts`). Runtime tests with `any` do not prove type compatibility.
- Inspect emitted declarations when packaging is part of the claim.

### Flaky or retry-dependent tests

- Inspect the first attempt and rerun the focused case without retries if execution is available.

## Feedback

Each finding has a short title, the smallest useful changed line range, the trigger and consequence, supporting evidence, and a direction for the fix.
