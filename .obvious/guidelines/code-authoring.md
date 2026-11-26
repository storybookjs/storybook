# Code Authoring Principles

This document is canonical for how to write code in this repo.
`AGENTS.md` owns the pointer to this file.

These are recurring failure modes in agent-authored changes to this repo.
Apply them when writing or reviewing code, not just when asked.

- **Write comments only for the two reasons in [Comments and JSDoc](./comments-and-jsdoc.md).** That document is the rule; this list does not restate it.
- **Verify environment assumptions empirically before encoding them.** If a design rests on "the bundler strips X" or "this metadata is empty here", prove it with a throwaway probe before building on it (and before writing it into a comment as fact). A 10-line experiment is cheaper than a wrong architecture.
- **Encode assumptions with static checks first.** If an assumption is expected to always hold, prefer making it impossible via TypeScript types and existing lint rules. When static checks are not practical, add a cheap runtime assertion close to the boundary so violations fail loudly at the source.
- **Avoid redundant tests already covered elsewhere.** Do not add tests for code patterns already guaranteed by TypeScript or linting, and do not duplicate coverage that already exists in Storybook `play` functions or Playwright tests.
- **Test contracts (including side effects), not private implementation details.** It is valid to assert side effects when they are part of the public contract. Avoid assertions about internals that are not part of an exported contract, user-visible DOM output, or externally observable behavior.
- **Bias toward broader coverage for security and migrations.** For security-sensitive code paths and legacy data migration logic, prefer handling more edge cases and documenting evidence for the chosen safeguards. Migration compatibility code should be explicitly version-scoped so it can be removed once the support window ends.
- **Prefer deletion and simplicity over speculative generality.** No abstraction, fallback, or "flexibility" for a consumer or scenario that does not exist in this codebase today. If a change adds many lines, check whether the right change removes them. Implement small logic inline when a shared helper is not clearly reused.
- **Keep e2e and long interaction tests as a readable continuous flow.** Do not force DRY with loops or heavy helpers when repetition is clearer.
- **Change project files through the effects module.** CLI code writes and removes project files with `effects.writeFile` and `effects.removeFile` from `storybook/internal/common`, and reads them with `effects.readFile`, so a dry run stages each change, later reads see it, and the command lists it at the end.
  A step that a file write cannot stage, such as an install or the `skills` CLI, goes through `effects.runCommand` or `effects.runStep`; the package manager's install, add and dedupe methods already do.
  Do not check `effects.isDryRun()` to skip a write, or to reword or hide a message: a dry run prints what a run prints, and only the command's intro and outro say it is a dry run.
  The list at the end says what a run would change.
  In `lib/cli-storybook`, `core/src/cli`, `core/src/common` and `core/src/csf-tools`, the `local-rules/project-writes-through-effects` lint rule rejects `node:fs` writes, and package manager commands that change the project outside `effects.runCommand`.
  A write that is not a project change, such as a cache, a lock or a temporary file, disables the rule with a reason, for example `// eslint-disable-next-line local-rules/project-writes-through-effects -- cache files, not project files`.
- **Put a story's human-facing description in JSDoc above the `meta` const**, not in a `description` parameter.
- **Keep historical telemetry string names stable** when renaming tools or APIs that emit telemetry, unless the field is brand-new and has no existing data.
- **Use git worktrees for parallel or experimental work.** Keep the primary workspace clean and base feature branches on `origin/next`, not a dirty local `next`.
