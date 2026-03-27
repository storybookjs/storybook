---
name: docs-review
description: Guide for reviewing and maintaining documentation. Use this when asked to review or update documentation.
---

# Documentation Review Guide

## Scope

ONLY review and maintain documentation files, such as README.md, CONTRIBUTING.md, and docs/ directory. Do NOT review or edit code files, configuration files, or any non-documentation files.

## Autonomous Workflow

Follow these steps when running a docs review end-to-end:

1. Run `yarn docs:check`; fix any errors it reports
2. Manually review the writing standards below for issues automated checks can't catch
3. Fix issues found
4. Run `yarn docs:check` again to confirm no regressions
5. Open a PR using the `pr` skill

## Automated Docs Validation

Storybook provides an automated script to check for these common documentation issues:

- **Broken relative links**: All `[text](./path.mdx)` and `[text](../path.mdx)` links in `.mdx` files are checked to ensure the target file exists. When a link includes a URL fragment (e.g. `#section-name`), the target file is also checked to ensure it contains a matching heading.
- **Missing CodeSnippets paths**: All `<CodeSnippets path="..." />` usages are checked to ensure the referenced file exists in `docs/_snippets/`.
- **Deprecated `<IfRenderer>` usage**: All `.mdx` files are checked for `<IfRenderer>` and should use `<If>` instead.
- **`<Callout>` missing variant prop**: All `<Callout>` tags must include a `variant` prop (`"info"` or `"warning"`).

### How to run the docs check

- **From the root:**
  ```bash
  yarn docs:check
  ```

This runs the script at `scripts/docs/check-docs.ts`. It will print a summary and exit with an error if any issues are found.

See `scripts/docs/check-docs.ts` for implementation details and to add new checks.

## Writing Standards

### Headings

- H1 via frontmatter `title` only; never use `# Heading` in the body
- H2/H3 use sentence case (capitalize first word and proper nouns only)
- Don't skip heading levels

### Links

- Internal: relative paths to `.mdx` files, e.g. `[text](../path/to/file.mdx)`
- External: full URLs

### Lists

- Unordered lists use `-` (not `*` or `+`)

### Inline formatting

- Backticks for file paths, function names, variable names, component names, CLI commands, config keys, type names
- Bold for UI labels and emphasis; italics sparingly

### Voice and tone

- Active voice, imperative mood, second person ("you")
- Professional but accessible

## Custom Components

### Callout standardization

- Always specify `variant` (`"info"` or `"warning"`). Bare `<Callout>` is not allowed.
- Standardized icon usage:
  - 💡 — tips and helpful information (`variant="info"`)
  - 🧪 — experimental/preview features (`variant="info"` or `variant="warning"`)
  - ℹ️ — additional context (`variant="info"`)
  - 📣 — announcements, combined with `title` prop (`variant="info"`)
  - ♿ — accessibility-specific (`variant="info"`)
  - ⚠️ — should use `variant="warning"`, not `variant="info"`
  - Icons are optional; if used, they must follow the mapping above
- No `style` prop on any component (`<Callout>`, `<YouTubeCallout>`, `<div>`, etc.)
- `variant="positive"` is non-standard; use `variant="info"` instead

### Other custom components

- `<If renderer={[...]}>` / `<If notRenderer={[...]}>` — conditional rendering
- `<CodeSnippets path="..." />` — path must exist in `docs/_snippets/`
- `<Video src="..." />` — embedded video
- `<YouTubeCallout id="..." title="..." />` — YouTube embed

## Formatting

Most formatting is handled automatically by scripts. These are opinionated guidelines to ensure consistency and readability across documentation files. When making edits, please follow these guidelines to maintain a high standard of documentation.

### Frontmatter

- Values are not wrapped in quotes, unless the value contains special characters (e.g. `&`, `|`, `:`, commas) that require quoting to be parsed correctly.
- When quoting is needed, use single quotes.
- Only use `sidebar.title` when it is different from the `title` field. If `sidebar.title` is not needed, it should be omitted.

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

### Block JSX elements (e.g. <Callout>, <details>, <If>)

- New line before and after elements (unless the content before/after is a comment, in which case there should be no new line between the comment and the element)
- New line before and after content inside elements (<summary> is an exception, there should be no new line between the opening <details> tag and the <summary> tag)
- Content is not indented, except when the content would normally be indented (e.g. nested list items, content inside codeblocks)

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
