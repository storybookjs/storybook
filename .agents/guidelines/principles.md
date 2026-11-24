# Principles

This document is the index of the engineering principles that agents apply in this repo.
Each principle is a skill in `.agents/skills/principle-*`, ported from [pstack-claude](https://github.com/michael-denyer/pstack-claude/tree/main/plugins/pstack/skills) under the MIT license that sits beside each skill.
`AGENTS.md` owns the pointer to this file.

## How to apply them

- Each entry names when it applies. When a trigger matches, read the leaf skill in full before you act on it.
- In your report, PR description, or hand-over, name each principle that shaped a decision and the specific choice it changed.
- Cite only principles whose leaf `SKILL.md` you read in this session.
- A subagent cannot see this conversation. When you brief one for work that a principle covers, give it the path to this file or to the leaf.

## Core

- **[Laziness Protocol](../skills/principle-laziness-protocol/SKILL.md).** Refactoring, sizing a diff, or tempted to add abstractions, layers, or signal threading. Bias to deletion and the smallest change that solves the problem.
- **[Foundational Thinking](../skills/principle-foundational-thinking/SKILL.md).** Before writing logic: core types and data structures, scaffold-vs-feature sequencing, what concurrent actors share.
- **[Redesign from First Principles](../skills/principle-redesign-from-first-principles/SKILL.md).** Integrating a new requirement into an existing design. Redesign as if it had been foundational from day one.
- **[Attack the Premise](../skills/principle-attack-the-premise/SKILL.md).** Two or more fixes that share one premise have failed the same gate. Write the premise down and test it directly before you write another fix that assumes it.
- **[Subtract Before You Add](../skills/principle-subtract-before-you-add/SKILL.md).** Sequencing an addition, refactor, or rewrite. Remove dead weight first, then build on the simpler base.
- **[Minimize Reader Load](../skills/principle-minimize-reader-load/SKILL.md).** Reviewing or shaping code that is hard to trace. Count layers and hidden state, collapse one-caller wrappers, shrink mutable scope.
- **[Outcome-Oriented Execution](../skills/principle-outcome-oriented-execution/SKILL.md).** Planned rewrites and migrations with explicit phase boundaries. Converge on the target architecture, do not preserve throwaway compatibility states.
- **[Experience First](../skills/principle-experience-first/SKILL.md).** Product, UX, or feature-scope tradeoffs. Choose user delight over implementation convenience.
- **[Exhaust the Design Space](../skills/principle-exhaust-the-design-space/SKILL.md).** A novel interaction or architectural decision with no precedent. Build 2-3 competing prototypes and compare before committing.
- **[Build the Lever](../skills/principle-build-the-lever/SKILL.md).** Any non-trivial work. Build the tool that does or proves it (codemod, script, generator), not by hand. The tool is the artifact a reviewer reruns.

## Architecture

- **[Model the Domain](../skills/principle-model-the-domain/SKILL.md).** Writing stateful logic, or code that branches a lot or repeats a shape assumption across files. Encode the domain in a structure (state machine, typed model, table or registry, reducer, boundary, the right collection) instead of scattered conditionals.
- **[Boundary Discipline](../skills/principle-boundary-discipline/SKILL.md).** Wiring validation, error handling, or framework adapters. Guards at system boundaries, trust internal types, keep business logic pure.
- **[Type System Discipline](../skills/principle-type-system-discipline/SKILL.md).** Designing types or a signature. Make illegal states unrepresentable, brand primitives, parse external data at boundaries.
- **[Make Operations Idempotent](../skills/principle-make-operations-idempotent/SKILL.md).** Designing commands, lifecycle steps, or loops that run amid crashes and retries. Converge to the same end state.
- **[Migrate Callers Then Delete Legacy APIs](../skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md).** Introducing a new internal API while old callers exist. Migrate and delete in one wave.
- **[Separate Before Serializing Shared State](../skills/principle-separate-before-serializing-shared-state/SKILL.md).** Concurrent actors might write the same file, branch, key, or object. Eliminate the sharing first.

## Verification

- **[Prove It Works](../skills/principle-prove-it-works/SKILL.md).** After a task, before declaring done. Verify against the real artifact, not a proxy or "it compiles".
- **[Fix Root Causes](../skills/principle-fix-root-causes/SKILL.md).** Debugging. Trace each symptom back to the first place the system went wrong and fix it there. A guard is a fix only when the state it handles is legitimate.
- **[Sequence Work into Verifiable Units](../skills/principle-sequence-verifiable-units/SKILL.md).** Multi-step work (sweeps, migrations, runs of similar edits) and how you stack commits and PRs. Break work into small units that each end in a check, verify each before the next, and order delivery so the sequence proves itself.
- **[Test Behavior, Not Implementation](../skills/principle-test-behavior-not-implementation/SKILL.md).** Writing, changing, or keeping a test. Assert what the code's users can observe, so the test fails when that behavior breaks and keeps passing when only the internals change.
- **[Explain the Number](../skills/principle-explain-the-number/SKILL.md).** Before you measure, and before you trust, report, or act on a number you measured (a speedup, a regression, a throughput, a latency, or an eval result). Find what limits it, and rule out that it measured something other than the work you think.

## Delegation

- **[Guard the Context Window](../skills/principle-guard-the-context-window/SKILL.md).** Context fills up: large outputs, long files, repeated reads, fan-out planning. Route bulk to subagents, keep summaries in the main thread.
- **[Never Block on the Human](../skills/principle-never-block-on-the-human/SKILL.md).** Tempted to ask "should I do X?" on reversible work. Proceed, present the result, let the human course-correct.

## Meta

- **[Encode Lessons in Structure](../skills/principle-encode-lessons-in-structure/SKILL.md).** You catch yourself writing the same instruction a second time. Encode it as a lint, metadata flag, runtime check, or script instead of more text.
