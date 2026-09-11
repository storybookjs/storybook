---
name: docs-review
description: Review, improve, rewrite, author, or plan Storybook documentation in /docs. Use this when asked to review docs, improve a page, rewrite documentation, draft new docs, or advise on docs strategy.
---

# Documentation Review

## Scope

This skill applies to documentation files in `/docs` and docs-owned snippet files in `docs/_snippets/`. Do not use this skill for non-docs files (code, configuration, READMEs outside `/docs`).

## Use This Skill When

- Asked to review, improve, rewrite, or author documentation in `/docs`.
- Asked for advice on page structure, doc type, audience, or content strategy for `/docs`.
- Asked to fix formatting, style, or compliance issues in `/docs`.

## Use a Light Touch When

- The request is a trivial grammar or typo fix that does not need full diagnosis.
- The page is already structurally sound and only needs minor editorial cleanup.

## Reference Files

This skill uses four reference files under `references/`. Load them in order and only as needed:

| File | Owns | When to Load |
|------|------|--------------|
| `references/docs-principles.md` | North star, quality dimensions, dual-reader requirement | Always — read first |
| `references/docs-strategy.md` | Modes, doc types, intervention thresholds, page-shape guidance | Always — read second |
| `references/docs-antipatterns.md` | Diagnosis patterns and corrective moves | When diagnosing a weak or confusing draft |
| `references/storybook-style.md` | Editorial, MDX components, frontmatter, formatting, validation rules | In `maintenance` mode, or as the final pass of edit modes |

### Ownership Rules

- Strategy references do not own formatting or component rules.
- `storybook-style.md` does not own doc-type or intervention logic.
- This file (`SKILL.md`) owns workflow and handoffs only.

## Workflow

Follow this sequence for every request. Steps 1–4 are diagnosis; steps 5–7 are action.

### 1. Determine the Requested Outcome

Read the user's request and map it to a mode:

| Request Pattern | Mode |
|----------------|------|
| "Fix links, callouts, formatting" | `maintenance` |
| "Make this clearer", "improve this page" | `improve` |
| "This doc is a mess; rewrite it" | `rewrite` |
| "Draft docs for feature X" | `author` |
| "What kind of page should this be?" | `strategy` |
| "Review this doc" (unspecified) | **hybrid** — see below |

**Hybrid behavior:** For vague asks like "review this doc":
- If the draft is obviously weak or the ask implies planning → critique-first (lead with diagnosis).
- If the page is decent and the ask implies cleanup → improve-first (lead with edits).

**Default:** When ambiguous, default to `improve`, not `maintenance`.

### 2. Determine the Primary Doc Type

Read the page and classify it using the doc types in `references/docs-strategy.md`:

- `concept` — explains what something is and why it matters
- `task` — walks the reader through accomplishing a goal
- `reference` — lookup for options, API, or config
- `troubleshooting` — diagnose and fix a problem
- `migration` — move from one version or approach to another
- `decision guide` — choose between options

Always select **one** primary type, even if the page contains secondary elements.

After selecting the primary type, identify any **secondary sections** — sections with their own heading whose content follows a different doc type's shape. Note these for Step 3. See "Common Secondary Sections" in `references/docs-strategy.md` for expected combinations.

### 3. Diagnose the Draft

Evaluate the page against the quality dimensions in `references/docs-principles.md`, in order:

1. Intent clarity
2. Audience fit
3. Information shape
4. Conceptual clarity
5. Task usability
6. Example quality
7. Economy

For secondary sections, evaluate dimensions 3 (Information Shape) and 5 (Task Usability) against the secondary section's own doc type, not the page's primary type. All other dimensions apply page-wide.

If the page shows signs of structural weakness, load `references/docs-antipatterns.md` and check for common patterns.

### 4. Choose the Intervention Level

Use the thresholds in `references/docs-strategy.md`:

- No structural issues, minor style problems → `maintenance`
- Structure is okay but framing, order, or examples are weak → `improve`
- Structure is wrong for the page's job → `rewrite`
- Page does not exist → `author`
- User wants advice, not edits → `strategy`

**Hard rule:** When the draft is structurally weak, do not stop at sentence-level edits. Reorder, split, replace examples, or rewrite the page shape.

**Split/escalation rule:** If the dominant job is unclear or the page serves multiple unrelated jobs, switch to `strategy` mode or recommend a page split before polishing. Well-structured secondary sections (see `references/docs-strategy.md`) are not a reason to split.

### 5. Improve or Plan

Execute based on the chosen mode:

- **`maintenance`:** Apply editorial and compliance fixes. Load `references/storybook-style.md` as primary guide.
- **`improve`:** Strengthen framing, order, explanation, and examples. Keep the page's identity. Use `references/storybook-style.md` for the final pass.
- **`rewrite`:** Materially replace the page. Preserve sound content; discard or restructure the rest. Use `references/storybook-style.md` for the final pass.
- **`author`:** Write the page from scratch using the primary doc type's shape as a guide. Use `references/storybook-style.md` for the final pass.
- **`strategy`:** Return a planning artifact containing:
  - Audience
  - Page job
  - Primary doc type
  - Recommended outline
  - Split/merge recommendation (if applicable)
  - Preserve list (content worth keeping)
  - Do **not** edit files or run validation.

When editing, you may also improve docs-owned snippet files in `docs/_snippets/` if example quality depends on them.

### 6. Apply Storybook Style

For edit modes (`maintenance`, `improve`, `rewrite`, `author`):

- Load `references/storybook-style.md` if not already loaded.
- Apply voice, tone, heading, link, component, and frontmatter rules.
- This step is always downstream of structural and editorial work — never the first pass.

### 7. Validate

For edit modes only:

```bash
yarn fmt:write
yarn docs:check
```

Fix any errors reported by `yarn docs:check`, then run it again to confirm.

**Do not run validation in `strategy` mode** or when no files were edited.

## Handoffs

- **PR creation:** Do not create a PR automatically. If the user asks for end-to-end execution including a PR, hand off to the `pr` skill.
- **Snippet files:** This skill may edit files in `docs/_snippets/` when example quality requires it, but does not own snippet creation for non-docs purposes.
