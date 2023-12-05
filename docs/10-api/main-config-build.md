---
title: 'build'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `TestBuildConfig`

Provides configuration options to optimize Storybook's production build output.

## `test`

Type: `TestBuildFlags`

```ts
{
  disableBlocks?: boolean;
  disabledAddons?: string[];
  disableMDXEntries?: boolean;
  disableAutoDocs?: boolean;
  disableDocgen?: boolean;
  disableSourcemaps?: boolean;
  disableTreeShaking?: boolean;

}
```

Configures Storybook's production builds for performance testing purposes by disabling certain features from the build. When running ' build-storybook ', this feature is enabled by setting the `--test` [flag](./cli-options.md#build).

<Callout variant="info" icon="💡">

Enabling these features can cause build or runtime errors with Storybook. We recommend enabling only the features you need for your project.

</Callout>

### `test.disableBlocks`

Type: `boolean`

Excludes the `@storybook/blocks` package from the build, which generates automatic documentation with [Docs Blocks](../writing-docs/doc-blocks.md).

<CodeSnippets
paths={[
'common/main-config-test-disable-blocks.js.mdx',
'common/main-config-test-disable-blocks.ts.mdx',
]}
/>

### `test.disabledAddons`

Type: `string[]`

Sets the list of addons that will disabled in the build output.

<CodeSnippets
paths={[
'common/main-config-test-disable-disableaddons.js.mdx',
'common/main-config-test-disable-disableaddons.ts.mdx',
]}
/>

### `test.disableMDXEntries`

Type: `boolean`

Enabling this option removes user-written documentation entries in MDX format from the build.

<CodeSnippets
paths={[
'common/main-config-test-disable-mdx.js.mdx',
'common/main-config-test-disable-mdx.ts.mdx',
]}
/>

### `test.disableAutoDocs`

Type: `boolean`

Prevents automatic documentation generated with the [autodocs](../writing-docs/autodocs.md) feature from being included in the build.

<CodeSnippets
paths={[
'common/main-config-test-disable-autodocs.js.mdx',
'common/main-config-test-disable-autodocs.ts.mdx',
]}
/>

### `test.disableDocgen`

Type: `boolean`

Disables [automatic argType](./arg-types.md#automatic-argtype-inference) and component property inference with any of the supported static analysis tools based on the framework you are using.

<CodeSnippets
paths={[
'common/main-config-test-disable-docgen.js.mdx',
'common/main-config-test-disable-docgen.ts.mdx',
]}
/>

### `test.disableSourcemaps`

Type: `boolean`

Overrides the default behavior of generating source maps for the build.

<CodeSnippets
paths={[
'common/main-config-test-disable-sourcemaps.js.mdx',
'common/main-config-test-disable-sourcemaps.ts.mdx',
]}
/>

### `test.disableTreeShaking`

Type: `boolean`

Disables [tree shaking](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking) in the build.

<CodeSnippets
paths={[
'common/main-config-test-disable-treeshaking.js.mdx',
'common/main-config-test-disable-treeshaking.ts.mdx',
]}
/>
