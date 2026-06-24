# Storybook Style

This file owns Storybook-specific editorial, MDX component, frontmatter, and validation rules. It does **not** own doc-type identification, mode routing, or intervention logic — those belong in `docs-strategy.md`.

## Voice and Tone

### Point of View

- Second person ("you") for addressing the reader — this is the default.
- First person plural ("we") when speaking from Storybook's perspective (e.g., "We recommend…") or walking through something together (e.g., "Let's take a look…").
- Do not use first person singular ("I") or third person for the reader ("the user").

### Tone

- Professional but conversational — write as if explaining to a colleague, not a textbook.
- Encouraging without being excessive — "That's great!" is fine occasionally; avoid over-the-top enthusiasm.
- Solution-focused — emphasize what readers *can* accomplish rather than limitations.
- Direct and confident — state recommendations clearly ("We recommend…") rather than hedging unnecessarily.

### Sentence Structure

- Prefer active voice over passive ("Storybook renders the component" not "The component is rendered by Storybook").
- Use short, direct sentences for emphasis and introductions.
- Longer sentences are acceptable when explaining complex relationships, but avoid run-ons.
- Lead with purpose — open sections by stating what something is or why it matters, not with background.

### Instructions

- Use imperative mood for step-by-step instructions: "Run this command", "Add the following", "Create a new file".
- Use suggestive phrasing for optional or alternative approaches: "You can also…", "You might want to…".
- Use declarative phrasing to introduce code examples with context: "To define the args of a single story, use the `args` CSF story key:".

### Contractions

- Use contractions naturally (don't, can't, won't, you'll, it's, we're) — they reinforce the conversational tone.
- Avoid contractions in callout warnings or other serious/cautionary contexts where precision matters.

### Technical Terms

- Define key terms on first use, then use them freely afterward (e.g., "Component Story Format (CSF)" then "CSF").
- Link to related concepts rather than re-explaining them inline.
- Assume basic web development knowledge (HTML, CSS, JavaScript, components) — don't over-explain fundamentals.
- Use backticks for all code-like terms (see [Inline Formatting](#inline-formatting)).

### Hedging

- Use "can" for capabilities and "may" or "might" for conditional outcomes.
- Use "should" for recommendations, "must" for requirements.
- Use "typically" or "generally" when describing common patterns that have exceptions.
- Don't hedge when the statement is straightforward — say "This adds…" not "This should add…".

### Word Choice

- Avoid minimizing language ("simply", "just", "easily", "obviously") — what's simple for one reader may not be for another.
- Use "powerful", "useful", or "great" sparingly and only when warranted.
- Be specific rather than vague — "renders in under 2 seconds" over "renders quickly".

### Introducing Examples

- Set up *why* before showing *how* — provide a brief sentence of context before code blocks.
- Use patterns like: "Here's how you could…", "For example, if you…", "To do X, use Y:".
- End the lead-in sentence with a colon when the code block directly follows.

### Section Openings

- Open with a 1–2 sentence summary of what the section covers and why it matters.
- Get to the point quickly — minimize preamble.
- The opening sentence should work as a standalone definition or value statement.

### Paragraph Length

- Keep paragraphs to 2–4 sentences for scannability.
- Introductory paragraphs should be 1–2 sentences.
- Break up longer explanations with headings, lists, or callouts.

## Headings

- H1 via frontmatter `title` only; never use `# Heading` in the body. `[auto]`
- H2/H3 use sentence case (capitalize first word and proper nouns only).
- Don't skip heading levels. `[auto]`

## Links

- Internal: relative paths to `.mdx` files, e.g. `[text](../path/to/file.mdx)`. `[auto]`
- External: full URLs, always wrapped in markdown link syntax (no bare URLs in prose). `[auto]`

## Lists

- Unordered lists use `-` (not `*` or `+`). `[oxfmt]`

## Inline Formatting

- Backticks for file paths, function names, variable names, component names, CLI commands, config keys, type names.
- Bold for UI labels and emphasis; italics sparingly.

## Custom Components

### Callout

- Always specify `variant` (`"info"` or `"warning"`). Bare `<Callout>` is not allowed.
- Standardized icon usage:
  - 💡 — tips and helpful information (`variant="info"`)
  - 🧪 — experimental/preview features (`variant="info"` or `variant="warning"`)
  - ℹ️ — additional context (`variant="info"`)
  - 📣 — announcements, combined with `title` prop (`variant="info"`)
  - ♿ — accessibility-specific (`variant="info"`)
  - ⚠️ — should use `variant="warning"`, not `variant="info"`. `[auto]`
  - Icons are optional; if used, they must follow the mapping above.
- `variant="positive"` is non-standard; use `variant="info"` instead. `[auto]`

### Other Components

- `<If renderer={[...]}>` / `<If notRenderer={[...]}>` — conditional rendering.
- `<CodeSnippets path="..." />` — path must exist in `docs/_snippets/`. `[auto]`
- `<Video src="..." />` — embedded video.
- `<YouTubeCallout id="..." title="..." />` — YouTube embed.

## Frontmatter

- Values are not wrapped in quotes, unless the value contains special characters (e.g. `&`, `|`, `:`, commas) that require quoting. `[auto]`
- When quoting is needed, use single quotes.
- Only use `sidebar.title` when it differs from `title`. If it matches, omit it. `[auto]`

**Good example:**

```yaml
---
title: Component Story Format (CSF)
sidebar:
  title: CSF
  order: 2
---
```

**Bad example:**

```yaml
---
title: "ArgTypes"
sidebar:
  title: "ArgTypes"
  order: 2
---
```

## Block JSX Elements

Block-level JSX elements (e.g. `<Callout>`, `<details>`, `<If>`) follow these rules:

- New line before and after elements (unless the content before/after is a comment, in which case there should be no new line between the comment and the element).
- New line before and after content inside elements (`<summary>` is an exception — no new line between the opening `<details>` tag and the `<summary>` tag).
- Content is not indented, except when the content would normally be indented (e.g. nested list items, content inside code blocks).

**Good example:**

````mdx
<If renderer={['react']}>

Other content.

<Callout variant="info">

This is a callout.

- This is a list item inside the callout
  - This is a nested list item inside the callout

```json
{
  "key": "value"
}
```

</Callout>

More other content.

<details>
<summary>This is a summary</summary>

This is content inside the details element.

</details>

More other content.

</If>
{/* End supported renderers */}
````

**Bad example:**

````mdx
<If renderer={['react']}>
Other content.

<Callout>
This is a callout.

- This is a list item inside the callout
- This is a nested list item inside the callout

```json
{
  "key": "value"
}
```

</Callout>
More other content.
<details>

<summary>This is a summary</summary>
This is content inside the details element.

</details>
More other content.

</If>

{/* End supported renderers */}
````

## Validation

Items marked `[auto]` above are checked by `yarn docs:check` (see `scripts/docs/check-docs.ts`). Items marked `[oxfmt]` are handled by `yarn fmt:write`.

These are final-stage validation tools. Run them after structural and editorial work is complete, not as the first step.
