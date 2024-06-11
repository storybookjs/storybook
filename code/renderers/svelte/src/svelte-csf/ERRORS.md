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

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_1`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_2`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_3`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_4`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_5`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_EXTRACT_COMPILED_6`

## `PARSER_ANALYSE_DEFINE_META`

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_1`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_2`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_3`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_4`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_5`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_6`

## `PARSER_ANALYSE_STORY`

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_1`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_2`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_3`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_4`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_5`

<!-- TODO:  -->

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_6`

<!-- TODO:  -->

## `COMPILER`

### `SB_SVELTE_CSF_COMPILER_1`

<!-- TODO:  -->

### `SB_SVELTE_CSF_COMPILER_2`

<!-- TODO:  -->

### `SB_SVELTE_CSF_COMPILER_3`

<!-- TODO:  -->
