# Migration

This document is a guide how to migrate the usage of addon from a specific version to next one.

## From `v4` to `v5`

### Version compatibility

**This new iteration of the addon will require Svelte 5.**\
While Svelte 5 itself largely supports the Svelte 4 syntax, this means that your actual components most likely don’t need to change, but as you’ll see below, your stories file will require migration to the new snippet syntax.

| Dependency                                                                                                             | Version  |
| ---------------------------------------------------------------------------------------------------------------------- | -------- |
| [Storybook](https://github.com/storybookjs/storybook)                                                                  | `v8.0.0` |
| [Svelte](https://github.com/sveltejs/svelte)                                                                           | `v5.0.0` |
| [Vite](https://github.com/vitejs/vite)                                                                                 | `v5.0.0` |
| [`@sveltejs/vite-plugin-svelte`](https://github.com/sveltejs/vite-plugin-svelte/tree/main/packages/vite-plugin-svelte) | `v4.0.0` |

> [!IMPORTANT]
> Removed support for Webpack.

---

### `<Meta>` component removed in favor of `defineMeta`

Before:

```svelte
<script>
  import { Meta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';
</script>

<Meta title="Atoms/Button" component={Button} args={{ size: 'medium' }} />
```

After:

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    title: 'Atoms/Button',
    component: Button,
    args: {
      size: 'medium',
    },
  });
</script>
```

Difference:

```diff
- <script>
+ <script module>
-  import { Meta } from "@storybook/addon-svelte-csf";
+  import { defineMeta } from "@storybook/addon-svelte-csf";

   import Button from "./Button.svelte";

+  const { Story } = defineMeta({
+    title: 'Atoms/Button',
+    component: Button,
+    args: {
+      size: 'medium',
+    },
+  });
</script>

- <Meta title="Atoms/Button" component={Button} args={{ size: "medium" }} />
```

---

### `export meta` removed in favor of `defineMeta`

Before:

```svelte
<script module>
  import { Story } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  export const meta = {
    title: 'Atoms/Button',
    component: Button,
    args: {
      size: 'medium',
    },
  };
</script>

<Story name="Default" />
```

After:

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    title: 'Atoms/Button',
    component: Button,
    args: {
      size: 'medium',
    },
  });
</script>
```

Difference:

```diff
<script module>
-   import { Story } from "@storybook/addon-svelte-csf";
+   import { defineMeta } from "@storybook/addon-svelte-csf";

    import Button from "./Button.svelte";

-   export const meta = {
+   const { Story } = defineMeta({
        title: 'Atoms/Button',
        component: Button,
        args: {
            size: 'medium',
        },
-   };
+   });
</script>
```

---

### `<Story>` slots replaced with snippets

1. [Inline snippet](./README.md#inline-snippet)
1. [Shared snippet](./README.md#shared-snippet)

---

### `<Story>` directive `let:args` replaced with snippets first argument

Before:

```svelte
<Story name="Default" let:args>
  <Button {...args} />
</Story>
```

After:

```svelte
<Story name="Default">
  {#snippet children(args)}
    <Button {...args} />
  {/snippet}
</Story>
```

Difference:

```diff
- <Story name="Default" let:args>
+ <Story name="Default">
+   {#snippet children(args)}
       <Button {...args} />
+   {/snippet}
 </Story>
```

---

### `<Story>` directive `let:context` replaced with snippets second argument

Before:

```svelte
<Story name="Context" let:context>
  <div>StoryContext.name = {context.name}</div>
  <div>StoryContext.id = {context.id}</div>
</Story>
```

After:

```svelte
<Story name="Context">
  {#snippet children(_args, context)}
    <div>StoryContext.name = {context.name}</div>
    <div>StoryContext.id = {context.id}</div>
  {/snippet}
</Story>
```

> [!NOTE]
> Snippet `children` second argument `context` is optional.

Difference:

```diff
- <Story name="Context" let:context>
+ <Story name="Context">
+    {#snippet children(_args, context)}
        <div>StoryContext.name = {context.name}</div>
        <div>StoryContext.id = {context.id}</div>
+    {/snippet}
 </Story>
```

---

### `<Template>` component removed

Svelte has deprecated support for slots in favour of **snippets**.\
We have **new ways of setting a template** for our `<Story>` components:

1. [Static template](./README.md#static-template)
1. [Default template](./README.md#default-template)

It’s also no longer required to define a template. Stories without templates will just render the component with args becoming props.

---

### `<Story>` prop `autodocs` has been removed

Before:

```svelte
<Story name="Default" autodocs />
```

After:

```svelte
<Story name="Default" tags={['autodocs']} />
```

---

### `<Story>` prop `source` has been removed

Before:

```svelte
<Story name="Default" source />
<!-- or -->
<Story name="Default" source={'<Button size="medium">Click me</Button>'} />
```

After:

```svelte
<Story name="Default" />
```

We’ve been able to improve the default source generation a lot because of the new snippets syntax, and therefore the `source` prop _(as a boolean)_ shouldn’t be necessary anymore.

You can still customize the generated source with the built-in parameters [`parameters.docs.source.code`](https://storybook.js.org/docs/api/doc-blocks/doc-block-source#code) and [`parameters.docs.source.transform`](https://storybook.js.org/docs/api/doc-blocks/doc-block-source#transform) . The string-based form of the `source` prop was in fact just a shorthand for the `code` parameter - streamlining this means fewer APIs to learn.
