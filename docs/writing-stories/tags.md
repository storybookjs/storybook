---
title: 'Tags'
---

Tags allow you to control which stories are included in your Storybook, enabling many different uses of the same total set of stories. For example, you can use tags to include/exclude tests from the [test runner](../writing-tests/test-runner.md#run-tests-for-a-subset-of-stories). For more complex use cases, see the [recipes](#recipes) section, below.

## Built-in tags

The following tags are available in every Storybook project:

| Tag        | Applied&nbsp;by&nbsp;default? | Description                                                                                                                                                                                                              |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `autodocs` | No                            | Stories tagged with `autodocs` will be included in the [docs page](../writing-docs/autodocs.md). If a CSF file does not contain at least one story tagged with `autodocs`, that component will not generate a docs page. |
| `dev`      | Yes                           | Stories tagged with `dev` are rendered in Storybook's sidebar.                                                                                                                                                           |
| `test`     | Yes                           | Stories tagged with `test` do not currently affect Storybook's UI, but can be used to filter the [test runner](../writing-tests/test-runner.md#run-tests-for-a-subset-of-stories).                                       |

The `dev` and `test` tags are automatically, implicitly applied to every story in your Storybook project.

## Applying tags

A tag can be any static (i.e. not created dynamically) string, either the [built-in tags](#built-in-tags) or custom tags of your own design. To apply tags to a story, assign an array of strings to the `tags` property. Tags may be applied at the project, component (meta), or story levels.

For example, to apply the `autodocs` tag to all stories in your project, you can use `.storybook/preview.js|ts`:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/tags-in-preview.js.mdx',
    'common/tags-in-preview.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Within a component stories file, you apply tags like so:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/tags-in-meta-and-story.js.mdx',
    'common/tags-in-meta-and-story.ts.mdx',
    'angular/tags-in-meta-and-story.ts.mdx',
    'web-components/tags-in-meta-and-story.ts.mdx',
    'web-components/tags-in-meta-and-story.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

## Removing tags

To remove a tag from a story, prefix it with `!`. For example:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/tags-remove-in-story.js.mdx',
    'common/tags-remove-in-story.ts.mdx',
    'angular/tags-remove-in-story.ts.mdx',
    'web-components/tags-remove-in-story.ts.mdx',
    'web-components/tags-remove-in-story.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Tags can be removed for all stories in your project (in `.storybook/preview.js|ts`), all stories for a component (in the CSF file meta), or a single story (as above).

## Recipes

### Docs-only stories

It can sometimes be helpful to provide example stories for documentation purposes, but you want to keep the sidebar navigation more focused on stories useful for development. By enabling the `autodocs` tag and removing the `dev` tag, a story becomes docs-only: appearing only in the [docs page](../writing-docs/autodocs.md) and not in Storybook's sidebar.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/tags-docs-only-in-meta.js.mdx',
    'common/tags-docs-only-in-meta.ts.mdx',
    'angular/tags-docs-only-in-meta.ts.mdx',
    'web-components/tags-docs-only-in-meta.ts.mdx',
    'web-components/tags-docs-only-in-meta.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

### Combo stories, still tested individually

For a component with many variants, like a Button, a grid of those variants all together can be a helpful way to visualize it. But you may wish to test the variants individually. You can accomplish this with tags like so:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'react/tags-combo-example.js.mdx',
    'react/tags-combo-example.ts.mdx',
    'vue/tags-combo-example.js.mdx',
    'vue/tags-combo-example.ts.mdx',
    'angular/tags-combo-example.ts.mdx',
    'web-components/tags-combo-example.js.mdx',
    'web-components/tags-combo-example.ts.mdx',
    'solid/tags-combo-example.js.mdx',
    'solid/tags-combo-example.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->
