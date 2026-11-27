# QA plan for Storybook 11.0

| Field | Value |
| --- | --- |
| Line | 11.0 |
| Version | 11.0.0-beta.3 |
| Window start | `v10.6.0` a77777356be2aeaff89d7a2b25254db7b2318392 |
| Window end | `v11.0.0-beta.3` e0ecb3ec6ba3648e9e5d2cf74002adec6aefe561 |
| Entries per run | 2 |

## Changes to test

| Entry | Batch | Repos | PRs |
| --- | --- | --- | --- |
| `story-sort-in-main` Story sort moves from the preview file to the main file | 1 | `mealdrop` | 1 |
| `preview-animations` Animations pause only in the preview | 1 | `mealdrop` | 1 |
| `csf-factory-namespaces` Legacy addon namespaces work in CSF factories | 1 | `mealdrop`, `mantine` | 1 |
| `sidebar-tree` The rebuilt sidebar tree | 2 | `mealdrop`, `primer-react` | 2 |
| Probe: `animation-probe` A new story's animation pauses in the preview | 3 | `mealdrop` | 1 |

## PRs that need manual QA

| Check | Why the sweep cannot test it | PRs |
| --- | --- | --- |
| On Windows 11, make a React project with the webpack builder with `npx create-storybook@11.0.0-beta.3 --type react --builder webpack5`, run `npx storybook dev`, and open `http://localhost:6006`: every story renders and none shows `Cannot find module`. Then run `npx storybook build` and open the static build: the stories render there too. | a fix that only Windows shows, and the sweep runs on Linux | [#37344](https://github.com/storybookjs/storybook/pull/37344) |

## PRs that need no QA

| Reason | PRs |
| --- | --- |
| the monorepo's docs E2E tests cover the timing | [#35618](https://github.com/storybookjs/storybook/pull/35618) |
| a change of this repository's CI, no project can see it | [#36664](https://github.com/storybookjs/storybook/pull/36664) |

## Groups of PRs marked qa:skip

| Group | Source | Decision | PRs |
| --- | --- | --- | --- |
| `ui` | area UI | `sidebar-tree`; manual for the rest: In a story with a select control, set the page direction to right-to-left and open the controls panel: the chevron of the select does not overlap its text. Why: the sidebar entry shows the tree only, and no repo of the catalog has a select control in a right-to-left story | [#35509](https://github.com/storybookjs/storybook/pull/35509) |
| `tooling` | area Tooling, no project | none: no effect that a project can show | [#34799](https://github.com/storybookjs/storybook/pull/34799) |
| `windows` | area Builder Vite | manual: On Windows 11, in a Vite project whose main file sets `staticDirs: ['../public']`, run `npx storybook build`: every file of `public` is in `storybook-static`. Why: a fix that only Windows shows, and the sweep runs on Linux | [#36307](https://github.com/storybookjs/storybook/pull/36307) |
| `addon-links` | area Addon Links | manual: In a React project with the Storybook Links addon, render a link whose `href` is `hrefToSync('Example/Button', 'Primary')` in a story, and click it: it opens that story. Why: no repo of the catalog has the state it acts on | [#36189](https://github.com/storybookjs/storybook/pull/36189) |

## Discovered repos

| Id | Repo at its commit | Package manager | Storybook directory | Storybook major | Stars | Pushed at | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `primer-react` | [primer/react](https://github.com/primer/react/tree/998b471a4ad78c7c23426038ef0c4a5261fc41cf) | npm | packages/react | 10 | 3936 | 2026-11-16T14:42:00Z | a deep sidebar tree that no catalog entry has |

## Steps

### `story-sort-in-main` Story sort moves from the preview file to the main file

- PRs: [#36137](https://github.com/storybookjs/storybook/pull/36137)
- Batch: 1
- Repo `mealdrop`: sets `storySort` in its preview file today
- Step: Read which automigrations the upgrade ran, and the diff of the main file and the preview file.
- Step: Start the dev server and fetch `http://localhost:6006/index.json`.
- Expected: The order of `/index.json` is the order of the baseline, and the upgrade output names a sort that it could not move.

### `preview-animations` Animations pause only in the preview

- PRs: [#31900](https://github.com/storybookjs/storybook/pull/31900)
- Batch: 1
- Repo `mealdrop`: its stories animate with CSS transitions
- Step: Open a story with a transition and take a screenshot after the play function ends.
- Expected: The screenshot shows the end state of the transition, the same as the baseline.

### `csf-factory-namespaces` Legacy addon namespaces work in CSF factories

- PRs: [#35658](https://github.com/storybookjs/storybook/pull/35658)
- Batch: 1
- Repo `mealdrop`: owned, so the factories can be enabled in a commit of the cycle
- Repo `mantine`: a large set of stories with addon parameters
- Step: Run `npx storybook doctor` and build Storybook.
- Expected: The build ends with exit 0 and the doctor output names no addon namespace.

### `sidebar-tree` The rebuilt sidebar tree

- PRs: [#33422](https://github.com/storybookjs/storybook/pull/33422), [#35509](https://github.com/storybookjs/storybook/pull/35509)
- Batch: 2
- Repo `mealdrop`: a small tree with nested groups
- Repo `primer-react`: a deep tree, and a right-to-left story
- Step: #33422, #35509: Start the dev server, open `http://localhost:6006`, and take a screenshot of the expanded sidebar.
- Expected: Every group of `/index.json` shows in the sidebar, in the same order.

### `animation-probe` A new story's animation pauses in the preview

- PRs: [#31900](https://github.com/storybookjs/storybook/pull/31900)
- Batch: 3
- Probe: a story file src/AnimationProbe.stories.tsx with one story Fade In whose box fades in with a CSS animation of two seconds
- Repo `mealdrop`: owned, and its React and Vite setup loads a story file next to its components
- Step: Open the story animation-probe--fade-in and take a screenshot after the play function ends.
- Expected: The screenshot shows the box fully visible, the end state of the animation.
