## Strategy Artifact: `docs/writing-stories/index.mdx`

### Audience

Frontend developers new to Storybook who need to understand what stories are and how they're structured before diving into specific APIs (args, parameters, decorators, etc.).

### Page Job

Introduce the concept of stories — what they are, where they live, and how they're structured in CSF — then point readers to sub-pages for deeper topics.

### Primary Doc Type

`concept`

### Diagnosis

The page currently serves **four jobs simultaneously**:

1. **Concept intro** — what a story is, where stories live (good, keep)
2. **CSF format reference** — default exports, named exports, defining stories (partially keep)
3. **Custom rendering tutorial** — render functions, React Hooks, Solid Signals (move out)
4. **Sub-page summaries** — abbreviated sections on play function, parameters, decorators, multi-component stories (replace with "Next steps" links)

This maps to the **"overloaded overview"** antipattern. The page has 18+ `<If>`/`<If notRenderer>` conditional blocks, mixing framework-specific rendering details with universal concepts.

### Recommended Outline

```
1. Opening (2 sentences)
   - What a story is and why it matters
   - "Args" terminology note (keep existing)

2. Where to put stories (keep as-is)
   - File colocation pattern

3. Component Story Format (streamlined)
   - What CSF is, link to API reference
   - Meta (default export) — brief explanation + one example
   - Named exports — brief explanation + one example
   - Renaming stories (keep, it's short)

4. Writing stories with args (streamlined from "How to write stories")
   - Multiple stories building on each other (Secondary, Tertiary)
   - Reusing args across components (ButtonGroup example)
   - Live editing with Controls (keep videos)

5. Next steps (replace current inlined summaries)
   - Links to: args, parameters, decorators, play function, custom rendering, multi-component stories
```

### What to Relocate

| Content                                               | Current location                                      | Destination                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Custom rendering (render functions, story/meta level) | "Custom rendering" subsection                         | Keep a 1-sentence mention + link to CSF API reference (`../api/csf/index.mdx`) |
| React Hooks example                                   | `<If renderer="react">` block                         | CSF API reference or remove (it's an edge case, not intro material)            |
| Solid Signals example                                 | `<If renderer="solid">` block                         | CSF API reference or remove                                                    |
| Svelte CSF children/`asChild` details                 | `<If renderer="svelte">` blocks in "Defining stories" | Svelte-specific section of CSF API reference                                   |
| "Using the play function" summary                     | Section under "How to write stories"                  | Replace with one-line link in "Next steps"                                     |
| "Using parameters" summary                            | Section under "How to write stories"                  | Replace with one-line link in "Next steps"                                     |
| "Using decorators" summary                            | Section under "How to write stories"                  | Replace with one-line link in "Next steps"                                     |
| "Stories for two or more components"                  | Final section                                         | Replace with one-line link in "Next steps"                                     |

### Preserve List

- Opening definition of what a story is (both Svelte and non-Svelte variants)
- "Args" terminology note
- "Where to put stories" section (entire)
- CSF explanation and link to API reference
- Meta/default export example (`button-story-default-export-with-component.md`)
- Named export / defining stories example (`button-story-with-args.md`)
- "Rename stories" section
- Args reuse pattern (Secondary/Tertiary example + ButtonGroup example)
- Controls videos and explanation
- Static title analysis callout (non-Svelte)

### Expected Impact

- Conditional blocks reduced from 18+ to ~6 (Svelte CSF vs standard CSF at intro level only)
- Page becomes a clear concept page with a learning funnel to sub-pages
- Custom rendering details move to where users look them up (API reference), not where they learn what stories are
