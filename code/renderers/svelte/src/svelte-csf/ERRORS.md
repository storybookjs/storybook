# Errors

List of errors that can be thrown by this addon.

## `PARSER_EXTRACT_SVELTE`

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_1`

Parser couldn't find the Svelte component **[module tag]**.

Ensure the stories file which caused this error has the following initial code:

```svelte
<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  const { Story } = defineMeta({
    // define your stories meta here
  });
</script>
```

[module tag]: https://svelte.dev/docs/svelte-components#script-context-module

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_2`

You have used **default or namespace import** from this addon package.
Our parser doesn't support it.

Change in your stories file which caused this error:

```diff
- import svelteCsf from "@storybook/addon-svelte-csf";
+ import { defineMeta } from "@storybook/addon-svelte-csf";
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_3`

Parser couldn't find `defineMeta` import specifier from this addon package import inside the Svelte component **[module tag]**.

You might have forgotten to import it:

```diff
<script context="module">
- import { } from "@storybook/addon-svelte-csf";
+ import { defineMeta } from "@storybook/addon-svelte-csf";
</script>
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_4`

Parser couldn't find variable declaration with `defineMeta()` call inside the Svelte component **[module tag]**.

You might have forgotten to declare it:

```diff
<script context="module">
  import { defineMeta } from "@storybook/addon-svelte-csf";

+ const { Story } = defineMeta({
+    // define your stories meta here
+ });
</script>
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_5`

Parser couldn't find a component `Story` **destructured** from the variable declaration with `defineMeta()` call.

You might have used it incorrectly like this:

```diff
<script context="module">
- const Story = defineMeta({
+ const { Story } = defineMeta({
    // define your stories meta here
  });
</script>
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_6`

Parser couldn't find or recognize the **first argument** of the `defineMeta()` call.
Make sure it is a valid **object expression** which follows an interface [`Meta` from `@storybook/svelte`](https://github.com/storybookjs/storybook/blob/a496ec48c708eed753a5251d55fa07947a869e62/code/renderers/svelte/src/public-types.ts#L21-L28).

You might have used code incorrectly like this:

```diff
<script context="module">
- const Story = defineMeta();
+ const { Story } = defineMeta({
+    // define your stories meta here
+ });
</script>
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_7`

Parser couldn't find the snippet passed down to `<Story />` attribute _(prop)_ - `children` - at the root of HTML fragment in the stories file which caused this error.

Its trying to extract the snippet body as a stringified raw code for the Story source code.

<!-- TODO: Link to the docs might need updating once Svelte 5 is released -->

Ensure you're using [Svelte `v5` feature **snippet** correctly](https://svelte-5-preview.vercel.app/docs/snippets).

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_8`

Parser doesn't recognize or cannot find the snippet identifier passed as an first argument to this addon's feature `setTemplate()` function.

Below is a demonstration of correct usage:

```svelte
<script>
  setTemplate(template);
</script>

{#snippet template()}
  <!-- ... -->
{/snippet}
```

Perhaps you've made a typo?

## `PARSER_EXTRACT_COMPILED`

> [!NOTE]:
> **For maintainers**: Those errors are less likely caused by the user, but rather a bug with parsing on our end on the
> compiled output.

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_1`

Parser couldn't find `defineMeta` import specifier in the compiled output.

If you see this error, please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_2`

Parser couldn't find a variable declaration with `defineMeta` call in the compiled output.

If you see this error, please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_3`

Parser couldn't find the `export default` in the compiled output.

If you see this error, please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_4`

Parser couldn't find a 'Story' identifier in the compiled output.

If you see this error, please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_5`

Parser couldn't find a main function component for the `*.stories.svelte` file in the compiled output.

If you see this error, please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_6`

Parser failed to extract compiled Story component attributes _(aka props)_ as object expression.

If you see this error, please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

## `PARSER_ANALYSE_DEFINE_META`

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_1`

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

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_2`

Our parser spotted an invalid schema on the variable declaration from the `defineMeta` call.
You most likely forgot to destructure the return value.

```diff
- const Story = defineMeta({
+ const { Story } = defineMeta({
    component: Button,
});
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_3`

Our parser couldn't find auto-destructured `meta` identifier from the return value of `defineMeta()` in the compiled
output.

If you see this error, please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_4`

Our parser spotted an invalid schema on one of entries in the `defineMeta({ ... })` first argument.
Expected a **static string literal**, but got something else.

Those known and common keys should have a **static** string literal as value:

- **title**
- **name**

Do not use any function generating those values, because our parser doesn't know what those values return while
analysing the source code.

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_5`

Our parser spotted an invalid schema on one of entries in the `defineMeta({ ... })` first argument.
Expected an **array expression** `[/* items... */]`, but got something else.

Those known and common keys should be an array expression as value:

- **tags**

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_6`

Our parser spotted an invalid schema on one of entries in the `defineMeta({ ... })` first argument.

Those known keys should have array expression as value with only **static string literals** as items:

- **tags**

## `PARSER_ANALYSE_STORY`

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_1`

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

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_2`

Our parser found an invalid schema on an attribute _(prop)_ in one of `<Story />`.
An **array expression _(`[]`)_** was expected but found something else.

Those known and common attributes should be an **array expression** _(`[]`)_ as value:

- **tags**

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_3`

Our parser found an invalid schema on an attribute _(prop)_ in one of `<Story />`.
An **array expression _(`[]`)_ with static literal strings as items** was expected but found something else.

Those known and common attributes should be an **array expression with static literal strings** as items:

- **tags**

Example:

```svelte
<Story tags={['autodocs']} />
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_4`

Our parser couldn't find an attribute _(prop)_ `name` or `exportName` in one of `<Story />` components.

Please ensure that every `<Story />` component uses one of these attributes, see example below:

```svelte
<Story name="My Story" />
<!-- or ... -->
<Story exportName="MyStory" />
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_5`

Our parser found an invalid attribute - `exportName` - _(prop)_ value in one of `<Story />` component.

**It must be a valid JavaScript variable name.**
It must start with a letter, `$` or `_`, followed by letters, numbers, `$` or `_`.
Reserved words like `default` are also not allowed (see <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words>)

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_6`

Our parser found a duplicate value of `exportName` attribute _(prop)_ between two `<Story />` components.

**This can happen when `exportName` is implicitly derived by `name` attribute.**

Complex names will be simplified to a `PascalCased`, valid JavaScript variable name,
eg. `Some story name!!` will be converted to `SomeStoryName`.

You can fix this collision by providing a unique `exportName`` prop with`<Story exportName="SomeUniqueExportName" ... />`.

## `COMPILER`

### `SB_SVELTE_CSF_COMPILER_1`

There was an issue with code transformation on our side.
The parser tried to find `parameters` either in `defineMeta({})` entries or in `Story` _(compiled)_ props.

If you see this error, please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

### `SB_SVELTE_CSF_COMPILER_2`

Our parser spotted an invalid schema on the property `parameters.docs` either in `defineMeta ({})` entries or in `Story` _(compiled)_ props.
It was expected to be an **object expression** as value, but got something else.

If you haven't defined this property by yourself, then it's likely that the issue is on our side.
Please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.

### `SB_SVELTE_CSF_COMPILER_3`

Our parser spotted an invalid schema on the property `parameters.docs.description` either in `defineMeta ({})` entries or in `Story` _(compiled)_ props.
It was expected to be an **object expression** as value, but got something else.

If you haven't defined this property by yourself, then it's likely that the issue is on our side.
Please report it using the link below:
<https://github.com/storybookjs/addon-svelte-csf/issues/new>

While you create an issue, please provide original code of the stories file that caused this error.
It will help us investigate the occurred issue better.
