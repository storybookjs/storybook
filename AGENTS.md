# Storybook Agent Instructions

This file is the canonical instruction source for coding agents; `CLAUDE.md` and other entrypoints point here.
Storybook is a TypeScript monorepo: code lives in `code/`, build tooling in `scripts/`, and every PR targets `next`.

## Always

- Run commands from the repository root unless stated otherwise.
- After editing, format with `cd code && yarn fmt:write`.
- Test React components with stories and `play` functions, never `*.test.tsx`.
- Log through `storybook/internal/node-logger` or `storybook/internal/client-logger`, not `console.*`.
- Use explicit extensions on relative TS imports (`./foo.ts`), except framework component files such as `.vue` and `.svelte`.
- Do not commit incidental changes to generated files such as `code/core/src/manager/globals/exports.ts`.

## Never Run

- `yarn task dev` without an explicit sandbox template
- `yarn start`

Both start long-running dev servers.
`.github/workflows/claude.yml` `--disallowed-tools` mirrors this list; update both together.

## Read Before You Start

| Before you...                                             | Read                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| install, compile, lint, run commands, or debug a build    | [Development workflow](.agents/guidelines/development.md)                                                       |
| write or edit code                                        | [Code authoring](.agents/guidelines/code-authoring.md) and [Comments and JSDoc](.agents/guidelines/comments-and-jsdoc.md) |
| write or run tests                                        | [Testing](.agents/guidelines/testing.md)                                                                        |
| open or update a PR                                       | [Pull requests](.agents/guidelines/pull-requests.md)                                                            |
| touch `code/core` internals, presets, open services, or the tools CLI | [Architecture](.agents/guidelines/architecture.md)                                                  |
| do sandbox, E2E, or CI-parity work                        | [NX and `yarn task`](.agents/guidelines/nx-and-yarn-task.md) and [Sandboxes](.agents/guidelines/sandboxes.md)   |
| add or change an automigration                            | [`code/lib/cli-storybook/src/automigrate/README.md`](code/lib/cli-storybook/src/automigrate/README.md)          |

Contributor skills live in `.agents/skills/`; `.claude/skills/` references them.

## Code Review

Before reviewing a pull request or a diff, read [`.agents/guidelines/code-review.md`](.agents/guidelines/code-review.md) and follow it.

## Maintaining These Instructions

- Keep this file to the always-on rules and pointers. Put detail in the linked document that owns the topic, and update that document when its topic changes.
- If a topic disappears, remove its document and its pointer together.
- Keep `CLAUDE.md` and other agent entrypoints as thin references to this file.
- Turn recurring corrections into enforceable checks with [principle-encode-lessons-in-structure](.agents/skills/principle-encode-lessons-in-structure/SKILL.md).
