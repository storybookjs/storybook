# QA plan for Storybook 11.0

| Field | Value |
| --- | --- |
| Line | 11.0 |
| Version | 11.0.0-beta.3 |
| Window start | `v10.6.0` a77777356be2aeaff89d7a2b25254db7b2318392 |
| Window end | `v11.0.0-beta.3` e0ecb3ec6ba3648e9e5d2cf74002adec6aefe561 |
| Entries per run | 2 |

## Changes to test

### `story-sort-in-main` Story sort moves from the preview file to the main file

- PRs: #36137
- Batch: 1
- Repo `mealdrop`: sets `storySort` in its preview file today
- Step: Read which automigrations the upgrade ran, and the diff of the main file and the preview file.
- Step: Start the dev server and fetch `http://localhost:6006/index.json`.
- Expected: The order of `/index.json` is the order of the baseline, and the upgrade output names a sort that it could not move.

### `preview-animations` Animations pause only in the preview

- PRs: #31900
- Batch: 1
- Repo `mealdrop`: its stories animate with CSS transitions
- Step: Open a story with a transition and take a screenshot after the play function ends.
- Expected: The screenshot shows the end state of the transition, the same as the baseline.

### `csf-factory-namespaces` Legacy addon namespaces work in CSF factories

- PRs: #35658
- Batch: 1
- Repo `mealdrop`: owned, so the factories can be enabled in a commit of the cycle
- Repo `mantine`: a large set of stories with addon parameters
- Step: Run `npx storybook doctor` and build Storybook.
- Expected: The build ends with exit 0 and the doctor output names no addon namespace.

### `sidebar-tree` The rebuilt sidebar tree

- PRs: #33422, #35509
- Batch: 2
- Repo `mealdrop`: a small tree with nested groups
- Repo `primer-react`: a deep tree, and a right-to-left story
- Step: Start the dev server, open `http://localhost:6006`, and take a screenshot of the expanded sidebar.
- Expected: Every group of `/index.json` shows in the sidebar, in the same order.

## Discovered repos

| Id | Repo | Commit | Package manager | Storybook directory | Stars | Last push | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `primer-react` | primer/react | 998b471a4ad78c7c23426038ef0c4a5261fc41cf | npm | packages/react | 3936 | 2026-11-16 | a deep sidebar tree that no catalog entry has |

## PRs that need QA

| PR | Area | Title | Decision |
| --- | --- | --- | --- |
| #31900 | Preview | Preview: Only pause DocumentTimeline animations in preview-web | `preview-animations` |
| #33422 | UI | UI: Rebuild Sidebar Tree | `sidebar-tree` |
| #36137 | Core | Core: Replace preview storySort with chained storySorts in main | `story-sort-in-main` |
| #36664 | CI | CI: Cancel workflow when format check fails | skip: a change of this repository's CI, no project can see it |

## Undeclared PRs

| PR | Area | Title | Decision |
| --- | --- | --- | --- |
| #35618 |  | fix: wait for inline stories before rerendering docs | skip: the monorepo's docs E2E tests cover the timing |
| #35658 | Core | Core: Accept legacy addon namespaces in CSF factories | `csf-factory-namespaces` |

## Groups of maintainer PRs marked qa:skip

| Group | Source | Decision |
| --- | --- | --- |
| `ui` | area UI | `sidebar-tree` |
| `tooling` | area Tooling, no project | skip: no effect that a project can show |

## Maintainer PRs marked qa:skip

| PR | Area | Title | Group |
| --- | --- | --- | --- |
| #34799 | Tooling | Tooling: Use pkg.pr.new for canary releases | `tooling` |
| #35509 | UI | UI: Fix controls expander and select chevron overlap in RTL | `ui` |

## PRs verified by hand

| PR | Area | Title |
| --- | --- | --- |
| #36153 | Addon A11y | Addon A11y: Fix vision simulator color filters in Firefox |

## PRs marked qa:skip

| PR | Area | Title |
| --- | --- | --- |
| #36189 | Addon Links | Addon Links: Add `hrefToSync` function for synchronous url generation |
