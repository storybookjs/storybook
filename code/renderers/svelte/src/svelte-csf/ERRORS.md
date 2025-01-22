# Errors

This document is a list of known errors that this addon throws.

## `PARSER_EXTRACT_SVELTE`

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0001`

No **[module context]** was found in the stories file.

This often happens if you call `defineMeta(...)` in a regular instance script (`<script>`) and not in a module script (`<script module>`), which is required.

Ensure the stories file which caused this error has the following initial code:

```svelte
<script module>
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
<script module>
+ import { defineMeta } from "@storybook/addon-svelte-csf";
  ...
</script>
```

### `SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0004`

No variable declaration from the `defineMeta()` call was found. While you might have called `defineMeta()`, its result needs to be assigned to a variable:

```diff
<script module>
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
<script module>
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
<script module>
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

A `<Story>` component received an invalid `template` prop. If set, the `template` prop must be a reference to a [snippet](https://svelte-5-preview.vercel.app/docs/snippets) defined in the root scope file. Eg.:

```svelte
{#snippet template()}
  <span>🚀</span>
{/snippet}

<Story name="Rocket" {template} />
```

This error indicates that the `template` prop was passed, but it was not correctly referencing a snippet.

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

### SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0009

Storybook stories indexer parser threw an unrecognized error.
If you see this error, [please report it on the issue tracker on GitHub](https://github.com/storybookjs/addon-svelte-csf/issues/new?assignees=&labels=bug&projects=&template=bug_report.md&title=%5BBug%5D).

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

The `component` property in `defineMeta` was not referencing an imported Svelte component.
It expected an identifier to a Svelte component but got something else.

Ensure you're using the correct syntax, following the example below:

```svelte
<script module>
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

When analysing the object passed to `defineMeta({ ... })`, invalid properties were found. The following properties must be **static string literals**, but got something else:

- `title`
- `name`

Dynamically generating these properties with functions or with template strings is not supported.

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_0004`

When analysing the object passed to `defineMeta({ ... })`, invalid properties were found. The `tags` property must be a **static array of static string literals**, but got something else

Dynamically generating the array or the entries with functions or with template strings is not supported.

### `SB_SVELTE_CSF_PARSER_ANALYSE_DEFINE_META_0005`

When analysing the object passed to `defineMeta({ ... })`, invalid properties were found. The `tags` property must be a **static array of static string literals**, but got something else

Dynamically generating the array or the entries with functions or with template strings is not supported.

## `PARSER_ANALYSE_STORY`

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0001`

When analysing one of the `<Story />` definitions, a **static literal string** was expected but found something else.

The following props to the `Story` component **must** be a **static literal string**:

- `name`
- `exportName`

Dynamically generating the string is not supported, eg. with a function or with template string.

Examples of valid syntax:

```svelte
<Story name="Default" />

<Story exportName="MyComponent" />
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0002`

When analysing one of the `<Story />` definitions, a **static array of static literal strings** was expected but found something else.

The `tags` prop to the `Story` component **must** be a **static array of static literal strings**.

Dynamically generating the array or the strings is not supported, eg. with a function or with template strings.

Examples of valid syntax:

```svelte
<Story tags={['autodocs', '!dev']} />
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0003`

When analysing one of the `<Story />` definitions, a **static array of static literal strings** was expected but found something else.

The `tags` prop to the `Story` component **must** be a **static array of static literal strings**.

Dynamically generating the array or the strings is not supported, eg. with a function or with template strings.

Examples of valid syntax:

```svelte
<Story tags={['autodocs', '!dev']} />
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0004`

When analysing one of the `<Story />` definitions, no `name` or `exportName` was found.

Please ensure that every `<Story />` component uses one or both of these attributes, see example below:

```svelte
<Story name="My Story" />
<!-- or ... -->
<Story exportName="MyStory" />
<!-- or ... -->
<Story name="My Story" exportName="OtherExportName" />
```

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0005`

The `exportName` prop in a `<Story />` component is not a valid JavaScript variable name.

**It must be a valid JavaScript variable name.**
It must start with a letter, `$` or `_`, followed by letters, numbers, `$` or `_`.
Reserved words like `default` are also not allowed (see <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words>).

### `SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0006`

Multiple `<Story />` components have duplicate export names.

**This can happen when `exportName` is implicitly derived by `name` attribute.**

Complex names will be simplified to a `PascalCased`, valid JavaScript variable name,
eg. `Some story name!!` will be converted to `SomeStoryName`.

You can fix this collision by providing a unique `exportName` prop with`<Story exportName="SomeUniqueExportName" ... />`.

See more in [the `exportName` API docs](./README.md#custom-export-name).

## `LEGACY_API`

### `SB_SVELTE_CSF_LEGACY_API_0001`

`<Story/>` component prop `template` value must be a text with string reference to existing `<Template />`'s `id` prop.

It cannot be a shorthand or a dynamic value.

```diff
<Story
-  template
-  template={dynamicId}
+  template="custom-template"
/>
```

### `SB_SVELTE_CSF_LEGACY_API_0002`

You are using legacy template API, with deprecated components.\
To enable support for legacy API, tweak this addon options in your _(`./.storybook/main.(j|t)s`)_ file:

See [the Legacy API section](./README.md#legacy-api) for more details.

```diff
addons: [
    // ... other addons
-    '@storybook/addon-svelte-csf',
+   {
+       name: '@storybook/addon-svelte-csf',
+       options: {
+           legacyTemplate: true,
+       },
+   },
],
```

### `SB_SVELTE_CSF_LEGACY_API_0003`

You have more than one unidentified `<Template>` components _(without an `id` prop)_ in your stories file.
This leads to unwanted behaviour at runtime.

To solve this issue, assign an `id` prop to the other `<Template>`(s) components.

```diff
- <Template>
+ <Template id="template-1">
```

And for the stories `<Story />` component(s) which are supposed to use this template, use the `template` prop with id as string reference.

```diff
- <Story>
+ <Story template="template-1">
```
