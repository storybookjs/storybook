---
name: docs-review
description: Guide for reviewing and maintaining documentation. Use this when asked to review or update documentation.
---

# Documentation Review Guide

## Scope

ONLY review and maintain documentation files, such as README.md, CONTRIBUTING.md, and docs/ directory. Do NOT review or edit code files, configuration files, or any non-documentation files.

## Common gotchas

- All relative links to other documentation files should point to the `.mdx` file and resolve correctly. If a link is broken, alert the author.
- All `paths` used by `<CodeSnippets>` components should exist in the `docs/_snippets` directory. If a `path` does not exist, alert the author.
- Use `<If>` instead of `<IfRenderer>`

## Formatting

Most formatting is handled automatically by scripts. These are opinionated guidelines to ensure consistency and readability across documentation files. When making edits, please follow these guidelines to maintain a high standard of documentation.

### Frontmatter

- Values are not wrapped in quotes, unless the value contains special characters (e.g. colons, commas) that require quoting to be parsed correctly.
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
