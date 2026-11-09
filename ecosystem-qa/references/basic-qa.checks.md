# Agent registry candidates from the manual checklist

This file says which rows of `basic-qa.md` the agent registry in `ecosystem-qa/checks.ts` should run.
A row qualifies when its probe is a command, a file edit, an HTTP request or a screenshot of a URL, and its pass condition is a fact the agent can read from output, a diff or `index.json`.
The agent only has the evidence tools in `ecosystem-qa/tools/` and may run only the commands its prompt and the registry name, so a row that needs a click in the manager does not qualify yet.

## Already in the registry

| Check id                     | Rows              |
| ---------------------------- | ----------------- |
| `upgrade.command`            | CLI-8             |
| `upgrade.automigrations`     | AM-1, CLI-17      |
| `upgrade.installed-version`  | CLI-9             |
| `upgrade.doctor`             | CLI-18            |
| `core.dev-server`            | MGR-1             |
| `core.story-render`          | MGR-3             |
| `core.docs-render`           | DOC-1, DOC-2      |
| `core.controls`              | CTL-1, CTL-3      |
| `core.hmr.stories-file`      | HMR-3             |
| `build.static`               | BLD-1, BLD-2      |
| `test.vitest-cli`            | TW-13             |

## Proposed for milestone 2

### Upgrade

| Proposed id                    | Rows        | Probe for the agent |
| ------------------------------ | ----------- | ------------------- |
| `upgrade.community-packages`   | CLI-10      | Diff every changed `package.json`. List each non-Storybook package the upgrade bumped and the Storybook peer range of its new version. |
| `upgrade.typescript`           | CLI-15      | When the project had no `typescript` dependency before the upgrade, check that `typescript` 5.9 or 6 is in `devDependencies` afterwards. `n/a` when the project already had it. |
| `upgrade.skills`               | AM-12, AI-1 | Check that `skills-lock.json` lists skills from `storybookjs/skills`. `n/a` for a framework the automigration does not support. |
| `upgrade.agents-md`            | AI-2, AI-3  | Read `git diff -- AGENTS.md CLAUDE.md .claude/CLAUDE.md CLAUDE.local.md`. The marked Storybook section is added, existing content is kept, and no `CLAUDE.md` is created. |
| `upgrade.removed-commands`     | CLI-25, CLI-26, CLI-27 | Run `storybook ai setup`, `storybook dev --preview-url x` and `storybook automigrate --renderer react`. Each exits non-zero with a message that names the replacement or the unknown option. |
| `upgrade.index-cli`            | CLI-20      | Run `storybook index` and compare its entry ids with the dev server's `index.json` from `core.dev-server`. |

### Dev

| Proposed id                    | Rows        | Probe for the agent |
| ------------------------------ | ----------- | ------------------- |
| `core.smoke-test`              | MGR-28      | Run `storybook dev --smoke-test --ci -p 6007` with a 120 second bound. It exits 0. |
| `core.frame-ancestors`         | MGR-30      | `curl -sI -m 5 http://localhost:6006/` and `.../iframe.html`. Both responses carry a `Content-Security-Policy` header with `frame-ancestors`. |
| `core.hmr.preview-file`        | HMR-2       | Add a global decorator that renders a marker element in `.storybook/preview.*`, screenshot the baseline story, and check the marker. Restore the file. |
| `core.hmr.rename-story`        | HMR-4       | Rename a story export, poll `index.json` until the old id is gone and the new one is present, screenshot the new id. Restore the file. |
| `core.hmr.new-file`            | HMR-5       | Add a stories file, poll `index.json` for its ids, screenshot one with an empty `.errors.json`. Delete the file. |
| `core.hmr.delete-file`         | HMR-6       | Delete a stories file, poll `index.json` until its ids are gone, and screenshot the manager root with an empty `.errors.json`. Restore the file. |
| `core.hmr.argtypes`            | HMR-8, DOC-7 | Add a typed prop to a component, then screenshot its docs entry and check the new prop name is in the args table text. Restore the file. `n/a` without `@storybook/addon-docs`. |
| `core.static-dirs`             | BLD-3       | `curl` one file from each `staticDirs` entry at its configured path. `n/a` without `staticDirs`. |
| `core.components-manifest`     | MCP-3, MCP-4 | `curl -m 5 http://localhost:6006/manifests/components.json` returns JSON with at least one component. `n/a` outside React, Vue 3 Vite and Angular Vite. |
| `core.mcp-info`                | MCP-1       | Screenshot `http://localhost:6006/mcp` with the shot tool; the page lists the toolsets as enabled. `n/a` without `@storybook/addon-mcp`. |
| `core.module-mocking`          | FW-17       | Screenshot a story whose module is registered with `sb.mock` and check it shows mocked data. `n/a` when the preview has no `sb.mock`. |

### Build

| Proposed id                    | Rows        | Probe for the agent |
| ------------------------------ | ----------- | ------------------- |
| `build.docs-mode`              | BLD-4       | `storybook build --docs -o storybook-docs`, serve it on 6008, and check `index.json` has only docs entries. `n/a` without docs entries. |
| `build.test-mode`              | BLD-5       | `storybook build --test -o storybook-test` exits 0, then screenshot one story from it. |

### Test

| Proposed id                    | Rows        | Probe for the agent |
| ------------------------------ | ----------- | ------------------- |
| `test.setup-annotations`       | TW-15, AM-8 | Search the Vitest setup files for `setProjectAnnotations`, then check `vitest.log` from `test.vitest-cli` has no `SB_ADDON_VITEST_0002`. |
| `test.coverage-cli`            | TW-8        | `npx vitest run --project storybook --coverage` writes a coverage report. `n/a` without a coverage provider installed. |
| `test.test-libraries`          | PS-3        | Search the stories and setup files for imports of `@testing-library/*`, `@vitest/expect`, `@vitest/spy` and `chai`, and check each is in the project's own `package.json`. |
| `test.test-runner`             | PS-4        | When `@storybook/test-runner` is installed, run its script against the dev server. It runs and prints the end-of-support warning. `n/a` otherwise. |

## Stays manual

These rows need a person, because the pass condition is a judgement about motion, wording, layout or feel, or the probe is an interaction an evidence tool cannot drive.

| Reason | Rows |
| ------ | ---- |
| Motion, focus and keyboard feel | MGR-5, MGR-6, MGR-7, MGR-16, MGR-17, MGR-18, MGR-25, ADD-6, ADD-7 |
| Visual layout and formatting | MGR-19, MGR-20, MGR-32, MGR-33, ADD-4, ADD-5, DOC-12, FW-10 |
| Wording and whether a message helps | CLI-6, CLI-11, CLI-12, CLI-13, CLI-14, CLI-16, CLI-24, AI-5, DOC-8, DOC-9, TW-9 |
| Generated code that needs reading | CTL-5, CTL-6, DOC-4, DOC-5, DOC-6, CSF-1, AM-3, AM-4 |
| Interactive prompts and tours | CLI-1, CLI-2, CLI-3, CLI-7, MGR-27, ADD-13 |
| Clicks in the manager or the test widget | MGR-8, MGR-11, MGR-12, MGR-22, MGR-23, MGR-24, MGR-26, CTL-2, CTL-4, CTL-8, TW-1, TW-2, TW-3, TW-4, TW-5, TW-6, TW-7, TW-10, TW-11, TW-12, TW-16, ADD-3, ADD-8, ADD-12 |
| Sensitive data in telemetry | TEL-1, TEL-4 |

The click rows could move into the registry once the agent has a tool that drives the manager, as `ecosystem-qa/tools/shot.mjs` drives screenshots.
The other rows not listed here depend on a framework, a feature flag or a second project, and suit a bug bash or a feature-focused session better than a sweep over unrelated repos.
