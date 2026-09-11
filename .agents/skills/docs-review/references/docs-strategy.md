# Docs Strategy

## Modes

The skill operates in one of five modes. Select the mode before doing any substantive work.

| Mode | When to use | Output |
|------|-------------|--------|
| `maintenance` | The page is structurally sound; only editorial, compliance, or formatting fixes are needed. | Clean up style, components, frontmatter, and formatting. Run validation. |
| `improve` | The page works but could be clearer, better organized, or better illustrated. | Strengthen framing, order, explanation, and examples while keeping the page's identity. Run validation. |
| `rewrite` | Local edits will not fix the page because its shape, framing, or scope is fundamentally wrong. | Materially replace the page. Preserve any sound content; discard or restructure the rest. Run validation. |
| `author` | A new page needs to be created, or a draft needs to be completed from notes or a brief. | Write the page from scratch using the appropriate doc type as a guide. Run validation. |
| `strategy` | The user wants planning, not edits — page-job analysis, outline, split/merge recommendation. | Return a planning artifact: audience, page job, primary doc type, recommended outline, split/merge recommendation, and a preserve list. Do **not** run formatting or validation. |

### Mode Selection Rules

- If the user explicitly names a mode (e.g., "rewrite this"), use it.
- If the user says "review this doc" without further specifics, use **hybrid behavior**:
  - Critique-first for `strategy` asks or obviously weak drafts.
  - Improve-first for normal cleanup or improvement asks.
- If the request is ambiguous (e.g., "improve this doc", "make this better"), default to `improve`.
- If diagnosis reveals the page is structurally weak, escalate from `improve` to `rewrite` — do not stop at sentence-level edits when the page shape is the problem.

## Doc Types

Every page has one primary doc type. Select it before editing. A page may also contain **secondary sections** — clearly headed sections whose content follows a different doc type's shape. This is normal and expected. The primary type determines the page's overall shape and evaluation criteria; each secondary section is evaluated by its own type's criteria.

| Doc Type | Page Job | Shape |
|----------|----------|-------|
| `concept` | Help the reader understand what something is and why it matters. | Definition → mental model → relationship to other concepts → when to use. |
| `task` | Help the reader accomplish a specific goal. | Goal statement → prerequisites → ordered steps → expected result → troubleshooting. |
| `reference` | Help the reader look up specific details (options, API, config). | Brief intro → structured entries (name, type, default, description) → examples where helpful. |
| `troubleshooting` | Help the reader diagnose and fix a problem. | Symptom → cause → fix → verification. |
| `migration` | Help the reader move from one version or approach to another. | What changed → why → step-by-step migration path → breaking changes → verification. |
| `decision guide` | Help the reader choose between options. | Decision context → options with trade-offs → recommendation → how to switch later. |

### Mapping Overview Pages

Overview pages in `/docs` (e.g., section landing pages) do not get a special type:

- Default to `concept` — most overviews explain what a feature area is and how its parts relate.
- Use `decision guide` when the page is primarily comparative (e.g., choosing a builder or renderer).

### Common Secondary Sections

Some doc type combinations appear frequently and are well-structured by convention:

| Primary Type | Common Secondary Section | Example |
|---|---|---|
| `task` | `reference` — API options or configuration table at the end | A "Configure visual tests" task page ending with a table of config options. |
| `task` | `troubleshooting` — common errors after the procedure | A "Set up Storybook" task page ending with "Common issues" entries. |
| `concept` | `task` — brief how-to showing the concept in action | A "Decorators" concept page including a short "Add a decorator" procedure. |
| `concept` | `reference` — summary table of related API surface | A "Controls" concept page ending with a table of annotation types. |
| `migration` | `troubleshooting` — known issues during migration | A migration guide ending with "If you see error X" fix entries. |
| `decision guide` | `reference` — comparison table of options | A "Choose a builder" page with a detailed feature-comparison table. |

A secondary section is well-structured when it:

1. Has its own clear heading that signals the content shift (e.g., "API reference", "Troubleshooting", "Quick start").
2. Follows the shape expected for its doc type (e.g., a reference section uses structured entries, not prose).
3. Supports the primary page job rather than introducing an unrelated topic.

### Split and Escalation

If diagnosis reveals the page is overloaded — serving multiple jobs with no clear primary — switch to `strategy` mode or recommend a page split before polishing.

**Not overload:** A page with well-structured secondary sections (see above) is not overloaded. A task page with a reference table at the end, or a concept page with a brief procedure, is normal.

**Signs of genuine overload:**

- The page has no clear primary doc type — two or more types compete for dominance with roughly equal weight.
- The page covers multiple unrelated features under one heading.
- A secondary section has grown large enough to stand alone as its own page (rough signal: it exceeds half the length of the primary content).
- Conceptual prose and step-by-step instructions are interleaved throughout the page rather than separated into distinct sections.

## Intervention Thresholds

Use the smallest intervention that materially improves reader usefulness:

- **No structural issues, minor style problems** → `maintenance`
- **Structure is okay but framing, order, or examples are weak** → `improve`
- **Structure is wrong for the page's job** → `rewrite`
- **Page does not exist** → `author`
- **User wants advice, not edits** → `strategy`
