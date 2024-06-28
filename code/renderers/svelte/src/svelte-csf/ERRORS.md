# Errors

This document is a list of known errors that this addon throws.

## `PARSER_EXTRACT_SVELTE`

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0001`

No **[module context]** was found in the stories file.

This often happens if you call `defineMeta(...)` in a regular instance script (`<script>`) and not in a module script (`<script context="module">`), which is required.

Ensure the stories file which caused this error has the following initial code:

```svelte
<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  const { Story } = defineMeta({
    // define your stories meta here
  });
</script>
```

[module context]: https://svelte.dev/docs/svelte-components#script-context-module

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0002`

A **default or namespace import** was used to import from this addon package, which is not supported. Only named imports are supported (this only applies to imports from `@storybook/addon-svelte-csf`).

Change your import to a named import instead:

```diff
- import svelteCsf from "@storybook/addon-svelte-csf";
+ import { defineMeta } from "@storybook/addon-svelte-csf";
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0003`

No import of `defineMeta` from this addon package was found in the **[module context]**.

You might have forgotten to import it:

```diff
<script context="module">
+ import { defineMeta } from "@storybook/addon-svelte-csf";
  ...
</script>
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004`

No variable declaration from the `defineMeta()` call was found. While you might have called `defineMeta()`, its result needs to be assigned to a variable:

```diff
<script context="module">
  import { defineMeta } from "@storybook/addon-svelte-csf";

- defineMeta(...);
+ const { Story } = defineMeta({
+    // define your stories meta here
+ });
</script>
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0005`

No **destructured** `Story` component was found in the variable declaration with the `defineMeta()` call.

The `Story` component might have been incorrectly created:

```diff
<script context="module">
- const Story = defineMeta({
+ const { Story } = defineMeta({
    // define your stories meta here
  });
</script>
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0006`

The **first argument** to the `defineMeta()` call was invalid.
It must be a valid **object expression** with the same structure as [the Default export in CSF](https://storybook.js.org/docs/api/csf#default-export).

```diff
<script context="module">
- const { Story } = defineMeta();
+ const { Story } = defineMeta({
+   title: 'Path/To/MyComponent',
+   component: MyComponent,
+   decorators: [ ... ],
+   parameters: { ... },
+ });
</script>
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0007`

A `<Story>` component received an invalid `children` prop. If set, the `children` prop must be a reference to a [snippet](https://svelte-5-preview.vercel.app/docs/snippets) defined in the root scope file. Eg.:

```svelte
{#snippet template()}
  <span>🚀</span>
{/snippet}

<Story name="Rocket" children={template} />
```

This error indicates that the `children` prop was passed, but it was not correctly referencing a snippet.

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0008`

`setTemplate()` was called to set a default snippet, but the argument passed was not a reference to a root-level snippet in the file.

Below is a demonstration of correct usage:

```svelte
<script>
  setTemplate(template);
</script>

{#snippet template()}
  <!-- ... -->
{/snippet}
```

## `PARSER_EXTRACT_COMPILED`

> [!NOTE]
> The errors in this category are most likely internal bugs during parsing of the compiled output rather than caused by users' invalid code.

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_0001`

The import of `defineMeta` from this addon could not be found while parsing the _compiled_ code.

If you get this error, please open a bug report with detailed reproduction steps including the code that caused the error.

https://github.com/storybookjs/addon-svelte-csf/issues/new

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_0002`

A variable declaration with the `defineMeta` call could not be found while parsing the _compiled_ code.

If you get this error, please open a bug report with detailed reproduction steps including the code that caused the error.

https://github.com/storybookjs/addon-svelte-csf/issues/new

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_0003`

A default export could not be found while parsing the _compiled_ code. The Svelte compiler should automatically default export a component, but this couldn't be found for some reason.

If you get this error, please open a bug report with detailed reproduction steps including the code that caused the error.

https://github.com/storybookjs/addon-svelte-csf/issues/new

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_0004`

A `Story` identifier could not be found while parsing the _compiled_ code.

If you get this error, please open a bug report with detailed reproduction steps including the code that caused the error.

https://github.com/storybookjs/addon-svelte-csf/issues/new

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_0005`

A main function component could not be found while parsing the _compiled_ code.

If you get this error, please open a bug report with detailed reproduction steps including the code that caused the error.

https://github.com/storybookjs/addon-svelte-csf/issues/new

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_0006`

A Story-component's props could not be extracted as an object expression from the _compiled_ code.

If you get this error, please open a bug report with detailed reproduction steps including the code that caused the error.

https://github.com/storybookjs/addon-svelte-csf/issues/new

## `PARSER_ANALYSE_DEFINE_META`

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_0001`

Our parser spotted an invalid schema on the `component` entry.
It expected an identifier to a Svelte component but got something else.

Ensure you're using the correct syntax, following the example above:

```svelte
<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_0002`

Our parser spotted an invalid schema on the variable declaration from the `defineMeta` call.
You most likely forgot to destructure the return value.

```diff
- const Story = defineMeta({
+ const { Story } = defineMeta({
    component: Button,
});
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_0003`

Our parser couldn't find auto-destructured `meta` identifier from the return value of `defineMeta()` in the compiled
output.

If you see this error, please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_0004`

Our parser spotted an invalid schema on one of entries in the `defineMeta({ ... })` first argument.
Expected a **static string literal**, but got something else.

Those known and common keys should have a **static** string literal as value:

- **title**
- **name**

Do not use any function generating those values, because our parser doesn't know what those values return while
analysing the source code.

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_0005`

Our parser spotted an invalid schema on one of entries in the `defineMeta({ ... })` first argument.
Expected an **array expression** `[/* items... */]`, but got something else.

Those known and common keys should be an array expression as value:

- **tags**

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_0006`

Our parser spotted an invalid schema on one of entries in the `defineMeta({ ... })` first argument.

Those known keys should have array expression as value with only **static string literals** as items:

- **tags**

## `PARSER_ANALYSE_STORY`

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0001`

Our parser found an invalid schema on an attribute _(prop)_ in one of `<Story />`.
A **static literal string** was expected but found something else.

Those known and common attributes should have a **static** string literal as value:

- **name**
- **exportName**

Any functions that dynamically generates value is not supported.

Examples:

```svelte
<Story name="Default" />

<Story exportName="MyComponent" />
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0002`

Our parser found an invalid schema on an attribute _(prop)_ in one of `<Story />`.
An **array expression _(`[]`)_** was expected but found something else.

Those known and common attributes should be an **array expression** _(`[]`)_ as value:

- **tags**

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0003`

Our parser found an invalid schema on an attribute _(prop)_ in one of `<Story />`.
An **array expression _(`[]`)_ with static literal strings as items** was expected but found something else.

Those known and common attributes should be an **array expression with static literal strings** as items:

- **tags**

Example:

```svelte
<Story tags={['autodocs']} />
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0004`

Our parser couldn't find an attribute _(prop)_ `name` or `exportName` in one of `<Story />` components.

Please ensure that every `<Story />` component uses one of these attributes, see example below:

```svelte
<Story name="My Story" />
<!-- or ... -->
<Story exportName="MyStory" />
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0005`

Our parser found an invalid attribute - `exportName` - _(prop)_ value in one of `<Story />` component.

**It must be a valid JavaScript variable name.**
It must start with a letter, `$` or `_`, followed by letters, numbers, `$` or `_`.
Reserved words like `default` are also not allowed (see <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words>)

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0006`

Our parser found a duplicate value of `exportName` attribute _(prop)_ between two `<Story />` components.

**This can happen when `exportName` is implicitly derived by `name` attribute.**

Complex names will be simplified to a `PascalCased`, valid JavaScript variable name,
eg. `Some story name!!` will be converted to `SomeStoryName`.

You can fix this collision by providing a unique `exportName`` prop with`<Story exportName="SomeUniqueExportName" ... />`.
