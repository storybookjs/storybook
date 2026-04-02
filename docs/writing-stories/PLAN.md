# Plan: Improve the writing-stories docs section

## Context

The `/docs/writing-stories/` section (15 files) is Storybook's primary guide for story authoring. It has solid coverage but suffers from structural issues: the entry page is overloaded (18+ conditional blocks mixing concept/task/reference), sidebar ordering doesn't match a learning progression, composition info is fragmented across 3 pages, and several pages have content gaps or inconsistencies. This plan addresses these issues using the `/docs-review` skill.

---

## Phase 0: Strategy pass on `index.mdx`

**Mode:** `strategy` | **Impact:** Unblocks Phases 1 and 2a

`index.mdx` tries to be an intro, CSF format reference, rendering tutorial, and composition guide simultaneously. Run `/docs-review` in `strategy` mode to produce a split recommendation:

- **Trimmed `index.mdx`** (concept): What a story is, where stories live, CSF at a high level, pointers to sub-pages
- **Move out**: Custom rendering details (React hooks, Solid signals, render functions) to the CSF API reference or a new "Customizing story rendering" task page
- **Move out**: Abbreviated "Using parameters/decorators/play function" sections become a "Next steps" list

**Deliverable:** Strategy artifact with new outline, what to preserve, what to relocate.

---

## Phase 1: Sidebar reordering

**Mode:** `maintenance` (frontmatter only) | **Impact:** High (navigation)

Reorder to match a learning progression:

| File                                  | New order | Rationale                       |
| ------------------------------------- | --------- | ------------------------------- |
| `index.mdx`                           | 1         | Entry point first               |
| `args.mdx`                            | 2         | Core concept                    |
| `typescript.mdx`                      | 3         | Types for what you just learned |
| `parameters.mdx`                      | 4         | Static metadata                 |
| `decorators.mdx`                      | 5         | Wrapping/context                |
| `loaders.mdx`                         | 6         | Async data                      |
| `tags.mdx`                            | 7         | Organization                    |
| `play-function.mdx`                   | 8         | Interaction testing             |
| `naming-components-and-hierarchy.mdx` | 9         | Sidebar org                     |
| `mocking-data-and-modules/`           | 10        | Advanced                        |
| `build-pages-with-storybook.mdx`      | 11        | Advanced composition            |
| `stories-for-multiple-components.mdx` | 12        | Advanced composition            |

---

## Phase 2: High-impact content improvements

### 2a. `index.mdx` -- Rewrite

**Mode:** `rewrite` | **Doc type:** concept

Execute the Phase 0 split:

- 2-sentence intent-setting opening
- Reduce conditional blocks from 18+ to ~6
- Move React Hooks / Solid Signals / custom rendering details out
- Replace inlined sub-page summaries with a "Next steps" list
- Keep: what stories are, where they live, CSF overview, first example

### 2b. `decorators.mdx` -- Improve

**Mode:** `improve` | **Doc type:** task

- Add explanation of _why_ decorator ordering matters (inner renders inside outer) with a concrete example
- Expand "Using decorators to provide data" with one example or replace with direct cross-reference
- Fix stray colon on line 57

### 2c. `loaders.mdx` -- Improve

**Mode:** `improve` | **Doc type:** task

- Reframe opening: lead with use case (async data before render), then clarify when args/mocking are better
- Add "Component loaders" section between story and global levels
- Cross-reference parameter inheritance in "Loader inheritance" section
- Add "See also" link to mocking section

### 2d. `naming-components-and-hierarchy.mdx` -- Improve

**Mode:** `improve` | **Doc type:** task

- Remove "CSF 3.0" version qualifier (it's been default since Storybook 7)
- Add intent-setting opening sentence
- Add connection back to `index.mdx`

---

## Phase 3: Targeted content fixes

### 3a. `mocking-modules.mdx` -- Improve

- Address TODO on line 12: replace React-only inline example with `<CodeSnippets>` or add framework-agnostic note

### 3b. `build-pages-with-storybook.mdx` -- Improve

- Add note for non-React/Solid users pointing to mocking sub-section
- Trim "Avoiding mocking dependencies" (move detailed React context pattern to mocking-providers page)
- Strengthen "Args composition for presentational screens" (the unique value of this page)

### 3c. `play-function.mdx` -- Maintenance

- Remove redundant opening paragraph (nearly identical text repeated)

### 3d. `parameters.mdx` -- Maintenance

- Add cross-reference to `loaders.mdx` in "Rules of parameter inheritance"

---

## Phase 4: Gap-filling

### 4a. New decision guide: "Choosing the right story API"

**Mode:** `author` | **Doc type:** decision guide

Cover:

- **Args vs loaders vs parameters**: Args for controllable inputs, parameters for addon config, loaders for async data
- **Decorators vs render functions**: Decorators for wrapping, render for changing what renders
- **Mocking approaches**: Module vs provider vs network

Place at order ~8, shifting later pages.

### 4b. Cross-reference audit

**Mode:** `maintenance` (all files)

Ensure:

- Each sub-page links to `index.mdx` and related pages
- Mocking section referenced from `loaders.mdx`, `decorators.mdx`, `build-pages-with-storybook.mdx`
- Addons section referenced where addon behavior is discussed

---

## Execution approach

Each step uses `/docs-review` with the specified mode and page. Work through phases sequentially (0 -> 1 -> 2 -> 3 -> 4). Within phases, pages can be done in any order.

## Verification

After each phase:

- Run `yarn docs:check` to validate snippet references and formatting rules
- Run `yarn fmt:write` to auto-format
- Spot-check the Storybook docs site locally or review rendered MDX for readability
