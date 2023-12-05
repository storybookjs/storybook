---
title: 'features'
---

Parent: [main.js|ts configuration](./main-config.md)

Type:

```ts
{
  argTypeTargetsV7?: boolean;
  buildStoriesJson?: boolean;
  legacyDecoratorFileOrder?: boolean;
  legacyMdx1?: boolean;
  storyStoreV7?: boolean;
}
```

Enables Storybook's additional features.

## `buildStoriesJson`

Type: `boolean`

Default: `true`, when [`storyStoreV7`](#storystorev7) is `true`

Generates a `index.json` and `stories.json` files to help story loading with the on-demand mode.

<CodeSnippets
paths={[
'common/main-config-features-build-stories-json.js.mdx',
'common/main-config-features-build-stories-json.ts.mdx',
]}
/>

## `legacyDecoratorFileOrder`

Type: `boolean`

Apply decorators from preview.js before decorators from addons or frameworks. [More information](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#changed-decorator-order-between-previewjs-and-addonsframeworks).

<CodeSnippets
paths={[
'common/main-config-features-legacy-decorator-file-order.js.mdx',
'common/main-config-features-legacy-decorator-file-order.ts.mdx',
]}
/>

## `legacyMdx1`

Type: `boolean`

Enables support for MDX version 1 as a fallback. Requires [@storybook/mdx1-csf](https://github.com/storybookjs/mdx1-csf) to be installed.

<CodeSnippets
paths={[
'common/main-config-features-legacy-mdx-1.js.mdx',
'common/main-config-features-legacy-mdx-1.ts.mdx',
]}
/>

## `storyStoreV7`

Type: `boolean`

Default: `true`

Opts out of [on-demand story loading](#on-demand-story-loading); loads all stories at build time.

<CodeSnippets
paths={[
'common/main-config-features-story-store-v7.js.mdx',
'common/main-config-features-story-store-v7.ts.mdx',
]}
/>

## `argTypeTargetsV7`

(⚠️ **Experimental**)

Type: `boolean`

Filter args with a "target" on the type from the render function.

<CodeSnippets
paths={[
'common/main-config-features-arg-type-targets-v7.js.mdx',
'common/main-config-features-arg-type-targets-v7.ts.mdx',
]}
/>

## On-demand story loading

As your Storybook grows, it gets challenging to load all of your stories performantly, slowing down the loading times and yielding a large bundle. Out of the box, Storybook loads your stories on demand rather than during boot-up to improve the performance of your Storybook. If you need to load all of your stories during boot-up, you can disable this feature by setting the `storyStoreV7` feature flag to `false` in your configuration as follows:

<CodeSnippets
paths={[
'common/main-config-features-story-store-v7.js.mdx',
'common/main-config-features-story-store-v7.ts.mdx',
]}
/>

### Known limitations

Because of the way stories are currently indexed in Storybook, loading stories on demand with `storyStoreV7` has a couple of minor limitations at the moment:

- [CSF formats](../api/csf.md) from version 1 to version 3 are supported. The `storiesOf` construct is not.
- Custom [`storySort` functions](../writing-stories/naming-components-and-hierarchy.md#sorting-stories) receive more limited arguments.
