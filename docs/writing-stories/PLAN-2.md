# Plan: Re-review writing-stories docs with section-level classification

## Context

The `docs/writing-stories/` section was already improved by a demo run of `/docs-review`, but that run used the **old skill** that treated mixed doc types as an antipattern. The skill has since been updated (`2d1f06a2671`) to support **section-level classification** — well-structured secondary sections (e.g., a task section within a concept page) are now evaluated by their own doc type's criteria rather than triggering split recommendations.

The previous run was too aggressive in some places, stripping well-structured secondary task sections that should have been preserved. This plan re-runs `/docs-review` on pages that need correction, using the updated skill.

---

## Pages that need a fresh `/docs-review` pass

### 1. `index.mdx` — Rewrite (restore secondary sections)

**Mode:** `rewrite` | **Primary type:** concept | **Secondary sections:** task

The demo run converted this from a comprehensive tutorial into essentially a table of contents, removing multiple secondary task sections with code examples:

- "Custom rendering" (framework-specific task guidance with code)
- "Using the play function" (interaction testing with code example)
- "Using parameters" (configuration with code example)
- "Using decorators" (wrapper functionality with code examples)
- "Stories for two or more components" (multi-component pattern with examples)

These were **well-structured secondary task sections** within a concept overview — exactly the pattern the updated skill now supports. The rewrite should restore inline examples while keeping the streamlined structure.

**What to preserve from the demo run:** The improved opening, the "Where to put stories" cleanup, the CSF streamlining, the "Next steps" section (as addition, not replacement).

**What to restore from `next`:** Secondary task sections with code examples, adapted to be clearly headed and properly scoped. Use the phase-0.md strategy artifact as a guide, but don't strip task sections just because they're a different doc type.

### 2. `build-pages-with-storybook.mdx` — Improve (restore context container pattern)

**Mode:** `improve` | **Primary type:** task | **Secondary sections:** task (framework-specific)

The demo run removed the detailed "Avoiding mocking dependencies" section (React/Solid only) which included:

- Context-based container approach explanation
- File structure example
- Multiple implementation code examples
- Mocking containers in Storybook example

This was replaced with 3 summary paragraphs pointing to mocking-providers. The removed content is a well-structured, framework-specific task section that provides implementation details not found in the linked page.

**Action:** Re-run `/docs-review` to evaluate whether this content should be restored as a secondary task section, or whether the mocking-providers page adequately covers it.

### 3. `decorators.mdx` — Improve (evaluate with section-level lens)

**Mode:** `improve` | **Primary type:** concept | **Secondary sections:** task, reference

The demo run's changes here were mostly good (decorator ordering diagram, cleaner cross-refs). Re-run to evaluate secondary sections (e.g., "Context" reference section, framework-specific task sections) with the updated criteria.

### 4. `loaders.mdx` — Improve (component loaders + section evaluation)

**Mode:** `improve` | **Primary type:** concept | **Secondary sections:** task, reference

Two issues:

1. The "Component loaders" section (added by demo run) has only prose — needs a code example
2. Re-evaluate secondary sections with the updated skill

### 5. `args.mdx` — Improve (evaluate with section-level lens)

**Mode:** `improve` | **Primary type:** concept | **Secondary sections:** task, reference

Demo run changes were mostly formatting cleanup. Re-run to evaluate the React-specific "Setting args from within a story" task section and "Mapping to complex arg values" reference section with updated criteria.

---

## Pages that are fine as-is

These pages had appropriate changes from the demo run that don't conflict with section-level classification:

- `typescript.mdx` — formatting cleanup only
- `parameters.mdx` — cross-reference additions
- `play-function.mdx` — redundant opening removed
- `naming-components-and-hierarchy.mdx` — CSF 3.0 qualifier removed, opening added
- `tags.mdx` — formatting cleanup
- `mocking-data-and-modules/*.mdx` — formatting and cross-reference improvements
- `stories-for-multiple-components.mdx` — formatting cleanup
- `choosing-the-right-api.mdx` — new page, well-structured

---

## Cross-reference audit (after re-reviews)

**Mode:** `maintenance` across all files

After the above passes settle, do a final cross-reference pass:

1. Add `choosing-the-right-api.mdx` to "Next steps" in `index.mdx`
2. Link `choosing-the-right-api.mdx` from `args.mdx`, `parameters.mdx`, `loaders.mdx`, `decorators.mdx`
3. Ensure back-links to `index.mdx` from sub-pages that lack them

---

## Execution sequence

1. `/docs-review` rewrite `index.mdx` (highest impact — shapes the rest)
2. `/docs-review` improve `build-pages-with-storybook.mdx`
3. `/docs-review` improve `decorators.mdx`, `loaders.mdx`, `args.mdx` (can be done in any order)
4. Cross-reference audit (`maintenance` mode, all files)
5. Verification: `yarn docs:check` && `yarn fmt:write`

## Verification

- `yarn docs:check` — validate snippet references, formatting, links
- `yarn fmt:write` — auto-format
- Spot-check rendered output for sidebar ordering, secondary section headings, and link correctness

## Critical files

- `docs/writing-stories/index.mdx` — restore secondary task sections
- `docs/writing-stories/build-pages-with-storybook.mdx` — restore context container pattern
- `docs/writing-stories/loaders.mdx` — add component loaders code example
- `docs/writing-stories/decorators.mdx` — evaluate secondary sections
- `docs/writing-stories/args.mdx` — evaluate secondary sections
- `.agents/skills/docs-review/SKILL.md` — the updated skill definition
- `.agents/skills/docs-review/references/docs-strategy.md` — section-level classification rules
