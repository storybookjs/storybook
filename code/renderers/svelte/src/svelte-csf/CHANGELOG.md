# @storybook/addon-svelte-csf

## 5.1.1

### Patch Changes

- [#341](https://github.com/storybookjs/addon-svelte-csf/pull/341) Thanks [@Sidnioulz](https://github.com/Sidnioulz)! - Merge pull request #341 from storybookjs/add-provenance

## 5.1.0

### Minor Changes

- [#339](https://github.com/storybookjs/addon-svelte-csf/pull/339) Thanks [@yannbf](https://github.com/yannbf)! - Add support for Vite 8

## 5.0.12

### Patch Changes

- Thanks [@Sidnioulz](https://github.com/Sidnioulz)! - Prepare for 10.3 release

## 5.0.11

### Patch Changes

- [#338](https://github.com/storybookjs/addon-svelte-csf/pull/338) Thanks [@yannbf](https://github.com/yannbf)! - Chore: Upgrade internal dependencies
- [#336](https://github.com/storybookjs/addon-svelte-csf/pull/336) Thanks [@ndelangen](https://github.com/ndelangen)! - Update peerDependencies for Storybook

## 5.0.10

### Patch Changes

- [#332](https://github.com/storybookjs/addon-svelte-csf/pull/332) Thanks [@JReinhold](https://github.com/JReinhold)! - Use npm Trusted Publishing

## 5.0.9

### Patch Changes

- [#330](https://github.com/storybookjs/addon-svelte-csf/pull/330) Thanks [@JReinhold](https://github.com/JReinhold)! - Add the addon to Vite's optimizeDeps

## 5.0.8

### Patch Changes

- [#326](https://github.com/storybookjs/addon-svelte-csf/pull/326) Thanks [@ndelangen](https://github.com/ndelangen)! - Expand version range storybook to be compatible with SB10

## 5.0.7

### Patch Changes

- [#324](https://github.com/storybookjs/addon-svelte-csf/pull/324) Thanks [@timc13](https://github.com/timc13)! - Update peer deps for vite@7

## 5.0.6

### Patch Changes

- [#321](https://github.com/storybookjs/addon-svelte-csf/pull/321) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix raw code not being injected with Svelte v5.35.1+

## 5.0.5

### Patch Changes

- [#319](https://github.com/storybookjs/addon-svelte-csf/pull/319) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix reading `rawCode` from undefined `__svelteCsf`

## 5.0.4

### Patch Changes

- [#317](https://github.com/storybookjs/addon-svelte-csf/pull/317) Thanks [@JReinhold](https://github.com/JReinhold)! - Add `'play-fn'`-tag to stories with play-functions

## 5.0.3

### Patch Changes

- [#312](https://github.com/storybookjs/addon-svelte-csf/pull/312) Thanks [@JReinhold](https://github.com/JReinhold)! - Drop support for 9.0.0 prereleases, add support for 9.1.0 prereleases

## 5.0.2

### Patch Changes

- [#310](https://github.com/storybookjs/addon-svelte-csf/pull/310) Thanks [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold)! - fix: Prevent exported runtime stories from colliding with story names

## 5.0.1

### Patch Changes

- [#309](https://github.com/storybookjs/addon-svelte-csf/pull/309) Thanks [@xeho91](https://github.com/xeho91)! - fix: Allow user-defined local variable `meta` in stories

## 5.0.0

### Major Changes

### `setTemplate`-function removed in favor of `render` in `defineMeta`

The `setTemplate`-function has been removed. Instead reference your default snippet with the `render`-property in `defineMeta`:

```diff
<script module>
- import { defineMeta, setTemplate } from '@storybook/addon-svelte-csf';
+ import { defineMeta } from '@storybook/addon-svelte-csf';
  import MyComponent from './MyComponent.svelte';
  const { Story } = defineMeta({
    /* ... */
+   render: template
  });
</script>
-<script>
-  setTemplate(template);
-</script>
{#snippet template(args)}
  <MyComponent {...args}>
    ...
  </MyComponent>
{/snippet}
<Story name="With Default Template" />
```

This new API achieves the same thing, but in a less verbose way, and is closer aligned with Storybook's regular CSF. 🎉

> [!IMPORTANT]
> There is currently a bug in the Svelte language tools, which causes TypeScript to error with `TS(2448): Block-scoped variable 'SNIPPET_NAMAE' used before its declaration.`. Until that is fixed, you have to silent it with `//@ts-ignore` or `//@ts-expect-error`. See https://github.com/sveltejs/language-tools/issues/2653
> This release contains breaking changes related to the `children`-API. The legacy API stays as-is to maintain backwards compatibility.

### `children` renamed to `template`

The `children`-prop and `children`-snippet on `Story` has been renamed to `template`, to align better with Svelte's API and not be confused with Svelte's default `children`-snippet. If you have any stories using the `children` prop or snippet, you need to migrate them:

```diff
{#snippet template()}
  ...
{/snippet}
-<Story name="MyStory" children={template} />
+<Story name="MyStory" template={template} />
<Story name="MyStory">
-  {#snippet children(args)}
+  {#snippet template(args)}
    <MyComponent />
  {/snippet}
</Story>
```

### `Story` children are now forwarded to components

Previously, to define static stories, you would just add children to a `Story`, and they would be the full story. To make it easier to pass `children` to your components in stories, the children are now instead forwarded to the component instead of replacing it completely.
**Previously**:

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import MyComponent from './MyComponent.svelte';
  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<!--
This story renders:
This would be the full story, ignoring the MyComponent in the meta
-->
<Story name="Static Story">
  This would be the full story, ignoring the MyComponent in the meta
</Story>
```

**Now**:

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import MyComponent from './MyComponent.svelte';
  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<!--
This story renders:
<MyComponent>
  This is now forwarded to the component
</MyComponent>
-->
<Story name="MyComponent children">This is now forwarded to the component</Story>
```

To get the same behavior as previously, a new `asChild` boolean prop has been introduced on the `Story` component. `asChild` is a common prop in UI libraries, where you want the `children` to _be_ the output, instead of just being children of the Component. By adding that you can get the old behavior back, when you need more control over what the story renders:

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import MyComponent from './MyComponent.svelte';
  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<!--
This story renders:
This is the full story, ignoring the MyComponent in the meta
-->
<Story name="Static Story" asChild>
  This is the full story, ignoring the MyComponent in the meta
</Story>
```

- [#295](https://github.com/storybookjs/addon-svelte-csf/pull/295) Thanks [@JReinhold](https://github.com/JReinhold)! - Breaking: Add support for `render` in `defineMeta`, replacing `setTemplate`-function
- [#228](https://github.com/storybookjs/addon-svelte-csf/pull/228) Thanks [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold)! - Breaking: Rename `children` prop to `template`, require `asChild` for static stories
- [#284](https://github.com/storybookjs/addon-svelte-csf/pull/284) Thanks [@ndelangen](https://github.com/ndelangen)! - Require Storybook 8.2.0 and above, support Storybook 9.0.0 prereleases
- [#190](https://github.com/storybookjs/addon-svelte-csf/pull/190) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix missing `@storybook/docs-tools` dependency
- [#181](https://github.com/storybookjs/addon-svelte-csf/pull/181) Thanks [@tsar-boomba](https://github.com/tsar-boomba) [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold) [@benoitf](https://github.com/benoitf)! - Experimental support for Svelte 5

### Minor Changes

- [#297](https://github.com/storybookjs/addon-svelte-csf/pull/297) Thanks [@JReinhold](https://github.com/JReinhold)! - Add `'svelte-csf'` tag to all Svelte CSF stories
- [#281](https://github.com/storybookjs/addon-svelte-csf/pull/281) Thanks [@ndelangen](https://github.com/ndelangen)! - Dependencies: Support canaries and Storybook 9 prereleases
- [#186](https://github.com/storybookjs/addon-svelte-csf/pull/186) Thanks [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold)! - Restore & add support for legacy syntax

### Patch Changes

The addon now requires Storybook `8.2.0` and upwards (was previously 8.0.0), and has a peer dependency on the `storybook`-package. That package should always be in your project anyway though.

- [#302](https://github.com/storybookjs/addon-svelte-csf/pull/302) Thanks [@JReinhold](https://github.com/JReinhold) [@xeho91](https://github.com/xeho91)! - Fix types
- [#299](https://github.com/storybookjs/addon-svelte-csf/pull/299) Thanks [@JReinhold](https://github.com/JReinhold)! - Cleanup button example
- [#298](https://github.com/storybookjs/addon-svelte-csf/pull/298) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix Story `children` not overriding `args.children`
- [#296](https://github.com/storybookjs/addon-svelte-csf/pull/296) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix not working with `getAbsolutePath`
- [#266](https://github.com/storybookjs/addon-svelte-csf/pull/266) Thanks [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold)! - Fix tags Story-level tags not having an effect in Vitest integration
- [#285](https://github.com/storybookjs/addon-svelte-csf/pull/285) Thanks [@xeho91](https://github.com/xeho91)! - fix: Temporarily disable save from UI feature
- [#283](https://github.com/storybookjs/addon-svelte-csf/pull/283) Thanks [@ndelangen](https://github.com/ndelangen)! - Revert "upgrade to sb9 alpha"
- [#282](https://github.com/storybookjs/addon-svelte-csf/pull/282) Thanks [@ndelangen](https://github.com/ndelangen)! - upgrade to sb9 alpha
- [#269](https://github.com/storybookjs/addon-svelte-csf/pull/269) Thanks [@JReinhold](https://github.com/JReinhold)! - Internal: Add Visual Tests addon
- [#264](https://github.com/storybookjs/addon-svelte-csf/pull/264) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix legacy API template hook not running before Svelte in Vitest
- [#260](https://github.com/storybookjs/addon-svelte-csf/pull/260) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix badly formatted ESM that was breaking Node 22 and 23
- [#246](https://github.com/storybookjs/addon-svelte-csf/pull/246) Thanks [@paoloricciuti](https://github.com/paoloricciuti)! - fix: properly transform invalid identifiers
- [#248](https://github.com/storybookjs/addon-svelte-csf/pull/248) Thanks [@JReinhold](https://github.com/JReinhold)! - Pre-optimize internal modules
- [#247](https://github.com/storybookjs/addon-svelte-csf/pull/247) Thanks [@JReinhold](https://github.com/JReinhold)! - refactor: Stop using @storybook/client-logger
- [#244](https://github.com/storybookjs/addon-svelte-csf/pull/244) Thanks [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold)! - refactor(transform)!: `meta` no longer destructurable from `defineMeta()` call
- [#245](https://github.com/storybookjs/addon-svelte-csf/pull/245) Thanks [@xeho91](https://github.com/xeho91)! - fix: Support for legacy `source` prop when value is `TemplateLiteral`
- [#243](https://github.com/storybookjs/addon-svelte-csf/pull/243) Thanks [@JReinhold](https://github.com/JReinhold)! - Simplify imports
- [#242](https://github.com/storybookjs/addon-svelte-csf/pull/242) Thanks [@xeho91](https://github.com/xeho91)! - fix: Prevent parser indexer not letting other addon errors to throw
- [#241](https://github.com/storybookjs/addon-svelte-csf/pull/241) Thanks [@xeho91](https://github.com/xeho91)! - chore: Remove Vite plugin `post` enforcement
- [#237](https://github.com/storybookjs/addon-svelte-csf/pull/237) Thanks [@JReinhold](https://github.com/JReinhold)! - Support `@sveltejs/vite-plugin-svelte` v5
- [#236](https://github.com/storybookjs/addon-svelte-csf/pull/236) Thanks [@yannbf](https://github.com/yannbf)! - Support Vite 6
- [#219](https://github.com/storybookjs/addon-svelte-csf/pull/219) Thanks [@xeho91](https://github.com/xeho91)! - fix: Resolve existing type issues
- [#225](https://github.com/storybookjs/addon-svelte-csf/pull/225) Thanks [@xeho91](https://github.com/xeho91)! - Upgrade version ranges - drop support for Svelte 5 prereleases
- [#224](https://github.com/storybookjs/addon-svelte-csf/pull/224) Thanks [@xeho91](https://github.com/xeho91)! - fix: `parameters` attribute from legacy `<Story>` being removed
- [#222](https://github.com/storybookjs/addon-svelte-csf/pull/222) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix errors at `enhanceRollupError` in Vite
- [#217](https://github.com/storybookjs/addon-svelte-csf/pull/217) Thanks [@xeho91](https://github.com/xeho91)! - refactor: Replace deprecated `context="module"` with `module`
- [#218](https://github.com/storybookjs/addon-svelte-csf/pull/218) Thanks [@xeho91](https://github.com/xeho91)! - fix(pre-transform): Move stories target component import declaration from instance to module tag
- [#206](https://github.com/storybookjs/addon-svelte-csf/pull/206) Thanks [@JReinhold](https://github.com/JReinhold)! - v5: Fix tags being ignored
- [#201](https://github.com/storybookjs/addon-svelte-csf/pull/201) Thanks [@xeho91](https://github.com/xeho91)! - fix(parser): Resolve `autodocs` tag issue and extracting `rawCode`
- [#192](https://github.com/storybookjs/addon-svelte-csf/pull/192) Thanks [@JReinhold](https://github.com/JReinhold)! - Replace lodash usage with es-toolkit
- [#185](https://github.com/storybookjs/addon-svelte-csf/pull/185) Thanks [@benoitf](https://github.com/benoitf)! - chore: use dist folder to load the files
- [#305](https://github.com/storybookjs/addon-svelte-csf/pull/305) Thanks [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold) [@ndelangen](https://github.com/ndelangen) [@storybook-bot](https://github.com/storybook-bot) [@valentinpalkovic](https://github.com/valentinpalkovic) [@bichikim](https://github.com/bichikim) [@rChaoz](https://github.com/rChaoz) [@yannbf](https://github.com/yannbf)! - Resolve merge conflicts between `main` and `next`
- [#300](https://github.com/storybookjs/addon-svelte-csf/pull/300) Thanks [@xeho91](https://github.com/xeho91)! - chore(deps): Remove unused `svelte-preprocess`
- [#291](https://github.com/storybookjs/addon-svelte-csf/pull/291) Thanks [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold)! - ci(ESLint): Migrate to flat config & reconfigure
- [#293](https://github.com/storybookjs/addon-svelte-csf/pull/293) Thanks [@JReinhold](https://github.com/JReinhold)! - Add formatting check to CI
- [#263](https://github.com/storybookjs/addon-svelte-csf/pull/263) Thanks [@JReinhold](https://github.com/JReinhold)! - Add `@storybook/experimental-addon-test` to repo (internal)
- [#209](https://github.com/storybookjs/addon-svelte-csf/pull/209) Thanks [@xeho91](https://github.com/xeho91)! - refactor: Improve AST-related types readability & fix existing issues
- [#303](https://github.com/storybookjs/addon-svelte-csf/pull/303) Thanks [@JReinhold](https://github.com/JReinhold)! - Remove workarounds for Svelte TS snippet bug
- [#292](https://github.com/storybookjs/addon-svelte-csf/pull/292) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix `asChild` link in ERRORS.md
- [#230](https://github.com/storybookjs/addon-svelte-csf/pull/230) Thanks [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold)! - chore: Upgrade `vitest` and `vite` dependencies & `jsdom` -> `happy-dom`

## 4.2.0

### Minor Changes

- [#235](https://github.com/storybookjs/addon-svelte-csf/pull/235) Thanks [@yannbf](https://github.com/yannbf)! - Support Vite 6

## 4.1.7

### Patch Changes

- [#207](https://github.com/storybookjs/addon-svelte-csf/pull/207) Thanks [@JReinhold](https://github.com/JReinhold)! - Add support for story-level tags

## 4.1.6

### Patch Changes

- [#193](https://github.com/storybookjs/addon-svelte-csf/pull/193) Thanks [@bichikim](https://github.com/bichikim) [@JReinhold](https://github.com/JReinhold)! - Update indexer.ts

## 4.1.5

### Patch Changes

- [#198](https://github.com/storybookjs/addon-svelte-csf/pull/198) Thanks [@rChaoz](https://github.com/rChaoz)! - Fix type errors due to imports from @storybook/types

## 4.1.4

### Patch Changes

- [#187](https://github.com/storybookjs/addon-svelte-csf/pull/187) Thanks [@valentinpalkovic](https://github.com/valentinpalkovic)! - fix: Allow 8.2.0-beta.0 peer dependency of @storybook/svelte

## 4.1.3

### Patch Changes

- [#182](https://github.com/storybookjs/addon-svelte-csf/pull/182) Thanks [@ndelangen](https://github.com/ndelangen)! - Fix dependency on `@storybook/node-logger` and `@storybook/client-logger`
- [#179](https://github.com/storybookjs/addon-svelte-csf/pull/179) Thanks [@xeho91](https://github.com/xeho91)! - chore: Remove `fs-extra` in favor of `node:fs`
- [#180](https://github.com/storybookjs/addon-svelte-csf/pull/180) Thanks [@xeho91](https://github.com/xeho91)! - Update `pnpm` to `v9` & improve CI

## 4.1.2

### Patch Changes

- [#165](https://github.com/storybookjs/addon-svelte-csf/pull/165) Thanks [@JReinhold](https://github.com/JReinhold)! - Support Storybook 8
- Thanks [@JReinhold](https://github.com/JReinhold)! - Upgrade auto
- Thanks [@JReinhold](https://github.com/JReinhold)! - Support Storybook 8
- Thanks [@JReinhold](https://github.com/JReinhold)! - Merge branch 'next'
- [#173](https://github.com/storybookjs/addon-svelte-csf/pull/173) Thanks [@LuisEGR](https://github.com/LuisEGR)! - Update README.md

## 4.1.1

### Patch Changes

- [#169](https://github.com/storybookjs/addon-svelte-csf/pull/169) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Fix play function not running in the component scope
- Thanks [@JReinhold](https://github.com/JReinhold)! - Set git user in release action

## 4.1.0

### Minor Changes

- [#159](https://github.com/storybookjs/addon-svelte-csf/pull/159) Thanks [@joekrump](https://github.com/joekrump)! - Update versions of peer dependencies to allow latest Vite and Vite Svelte plugin

## 4.0.13

### Patch Changes

- [#158](https://github.com/storybookjs/addon-svelte-csf/pull/158) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Add component description from jsdoc on meta export

## 4.0.12

### Patch Changes

- [#157](https://github.com/storybookjs/addon-svelte-csf/pull/157) Thanks [@tylergaw](https://github.com/tylergaw)! - Exports package.json

## 4.0.11

### Patch Changes

- [#154](https://github.com/storybookjs/addon-svelte-csf/pull/154) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Parse comments as Story description

## 4.0.10

### Patch Changes

- [#153](https://github.com/storybookjs/addon-svelte-csf/pull/153) Thanks [@benmccann](https://github.com/benmccann)! - Update src/preset/indexer.ts
- [#153](https://github.com/storybookjs/addon-svelte-csf/pull/153) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Add support for experimental_indexers
- [#153](https://github.com/storybookjs/addon-svelte-csf/pull/153) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Upgrade dev dependencies to Storybook v7.5.2 and Svelte 4.2.2
- [#150](https://github.com/storybookjs/addon-svelte-csf/pull/150) Thanks [@brittneypostma](https://github.com/brittneypostma)! - Updated Readme to include component

## 4.0.9

### Patch Changes

- [#144](https://github.com/storybookjs/addon-svelte-csf/pull/144) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Fix reactivity of args when HMR remount the RenderContext

## 4.0.8

### Patch Changes

- [#142](https://github.com/storybookjs/addon-svelte-csf/pull/142) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Fix forwarding of actions handlers

## 4.0.7

### Patch Changes

- [#134](https://github.com/storybookjs/addon-svelte-csf/pull/134) Thanks [@benmccann](https://github.com/benmccann)! - Update src/parser/extract-stories.ts
- [#134](https://github.com/storybookjs/addon-svelte-csf/pull/134) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Allow 'meta' to be exported as const from module script
- [#134](https://github.com/storybookjs/addon-svelte-csf/pull/134) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Supports for tags in <Meta/>

## 4.0.6

### Patch Changes

- [#140](https://github.com/storybookjs/addon-svelte-csf/pull/140) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Allow configuration of filename patterns besides \*.stories.svelte

## 4.0.5

### Patch Changes

- [#139](https://github.com/storybookjs/addon-svelte-csf/pull/139) Thanks [@paoloricciuti](https://github.com/paoloricciuti)! - fix: MetaProps typing

## 4.0.4

### Patch Changes

- [#138](https://github.com/storybookjs/addon-svelte-csf/pull/138) Thanks [@paoloricciuti](https://github.com/paoloricciuti)! - fix: move MetaProps to its own declaration to allow for overrides

## 4.0.3

### Patch Changes

- [#137](https://github.com/storybookjs/addon-svelte-csf/pull/137) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Fix test snapshots

## 4.0.2

### Patch Changes

- [#136](https://github.com/storybookjs/addon-svelte-csf/pull/136) Thanks [@j3rem1e](https://github.com/j3rem1e)! - [Bug] titlePrefix in advanced story specifiers causes the story to crash with "Didn't find 'xyz' in CSF file"

## 4.0.1

### Patch Changes

- [#133](https://github.com/storybookjs/addon-svelte-csf/pull/133) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Fix svelte-stories-loader in Windows

## 4.0.0

### Major Changes

- [#128](https://github.com/storybookjs/addon-svelte-csf/pull/128) Thanks [@JReinhold](https://github.com/JReinhold)! - Require Svelte v4, vite-plugin-svelte v2, Vite v4

## 3.0.10

### Patch Changes

- [#127](https://github.com/storybookjs/addon-svelte-csf/pull/127) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix: `typeof Meta` in Svelte v3 (Pin Svelte peer dependency to v3)

## 3.0.9

### Patch Changes

- [#125](https://github.com/storybookjs/addon-svelte-csf/pull/125) Thanks [@benmccann](https://github.com/benmccann)! - Fix export condition

## 3.0.8

### Patch Changes

- [#126](https://github.com/storybookjs/addon-svelte-csf/pull/126) Thanks [@benmccann](https://github.com/benmccann)! - docs: remove broken link

## 3.0.7

### Patch Changes

- [#118](https://github.com/storybookjs/addon-svelte-csf/pull/118) Thanks [@hobbes7878](https://github.com/hobbes7878)! - Fix missing types by adding back `main` and `types` fields

## 3.0.6

### Patch Changes

- [#115](https://github.com/storybookjs/addon-svelte-csf/pull/115) Thanks [@paoloricciuti](https://github.com/paoloricciuti)! - fix: swap order of types to avoid module not found

## 3.0.5

### Patch Changes

- [#113](https://github.com/storybookjs/addon-svelte-csf/pull/113) Thanks [@hobbes7878](https://github.com/hobbes7878)! - Fix generated ESM, revamp build system

## 3.0.4

### Patch Changes

- [#112](https://github.com/storybookjs/addon-svelte-csf/pull/112) Thanks [@RSWilli](https://github.com/RSWilli)! - Update dependencies to support svelte@4

## 3.0.3

### Patch Changes

- [#106](https://github.com/storybookjs/addon-svelte-csf/pull/106) Thanks [@specialdoom](https://github.com/specialdoom)! - types: use `WebRenderer` type as new `Addon_BaseAnnotations` template variable

## 3.0.2

### Patch Changes

- [#99](https://github.com/storybookjs/addon-svelte-csf/pull/99) Thanks [@leika](https://github.com/leika)! - Fix stories not re-rendering when args change in Controls

## 3.0.1

### Patch Changes

- [#100](https://github.com/storybookjs/addon-svelte-csf/pull/100) Thanks [@andrescera](https://github.com/andrescera)! - fix: imports on index.d.ts file

## 3.0.0

### Major Changes

- [#95](https://github.com/storybookjs/addon-svelte-csf/pull/95) Thanks [@JReinhold](https://github.com/JReinhold)! - Expand Storybook version range
- [#81](https://github.com/storybookjs/addon-svelte-csf/pull/81) Thanks [@JReinhold](https://github.com/JReinhold)! - Require Storybook v7 in v3
- [#77](https://github.com/storybookjs/addon-svelte-csf/pull/77) Thanks [@JReinhold](https://github.com/JReinhold)! - Story Indexer

### Patch Changes

- [#94](https://github.com/storybookjs/addon-svelte-csf/pull/94) Thanks [@ysaskia](https://github.com/ysaskia)! - fix: preprocess svelte file during indexing
- [#84](https://github.com/storybookjs/addon-svelte-csf/pull/84) Thanks [@JReinhold](https://github.com/JReinhold)! - Support newest ESM-only `@sveltejs/vite-plugin`
- [#72](https://github.com/storybookjs/addon-svelte-csf/pull/72) Thanks [@IanVS](https://github.com/IanVS)! - Add vite support

## 2.0.11

### Patch Changes

- [#74](https://github.com/storybookjs/addon-svelte-csf/pull/74) Thanks [@RSWilli](https://github.com/RSWilli)! - Make types compatible with TypeScript `strict` mode

## 2.0.10

### Patch Changes

- [#76](https://github.com/storybookjs/addon-svelte-csf/pull/76) Thanks [@JReinhold](https://github.com/JReinhold)! - Revert "Implement a Svelte StoryIndexer" #76

## 2.0.9

### Patch Changes

- [#69](https://github.com/storybookjs/addon-svelte-csf/pull/69) Thanks [@j3rem1e](https://github.com/j3rem1e) [@JReinhold](https://github.com/JReinhold)! - Implement a Svelte StoryIndexer

## 2.0.8

### Patch Changes

- [#71](https://github.com/storybookjs/addon-svelte-csf/pull/71) Thanks [@IanVS](https://github.com/IanVS)! - Upgrade jest to 29

## 2.0.7

### Patch Changes

- [#66](https://github.com/storybookjs/addon-svelte-csf/pull/66) Thanks [@benmccann](https://github.com/benmccann)! - update description

## 2.0.6

### Patch Changes

- [#63](https://github.com/storybookjs/addon-svelte-csf/pull/63) Thanks [@benmccann](https://github.com/benmccann)! - remove transitive dependencies from peerDependencies
- [#61](https://github.com/storybookjs/addon-svelte-csf/pull/61) Thanks [@benmccann](https://github.com/benmccann)! - Add a link to native format example

## 2.0.5

### Patch Changes

- [#62](https://github.com/storybookjs/addon-svelte-csf/pull/62) Thanks [@benmccann](https://github.com/benmccann)! - Make `svelte-loader` optional

## 2.0.4

### Patch Changes

- [#58](https://github.com/storybookjs/addon-svelte-csf/pull/58) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Remove React from peerDependencies

## 2.0.3

### Patch Changes

- [#56](https://github.com/storybookjs/addon-svelte-csf/pull/56) Thanks [@francoisromain](https://github.com/francoisromain)! - Update peerdependencies to work with sb@next

## 2.0.2

### Patch Changes

- [#55](https://github.com/storybookjs/addon-svelte-csf/pull/55) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Fix names with special char at end

## 2.0.1

### Patch Changes

- [#49](https://github.com/storybookjs/addon-svelte-csf/pull/49) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Remove knobs references

## 2.0.0

### Major Changes

- [#42](https://github.com/storybookjs/addon-svelte-csf/pull/42) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Upgrade dependencies

## 1.1.2

### Patch Changes

- [#47](https://github.com/storybookjs/addon-svelte-csf/pull/47) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Allow a Story to access its context

## 1.1.1

### Patch Changes

- [#43](https://github.com/storybookjs/addon-svelte-csf/pull/43) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Fix generated id
- [#48](https://github.com/storybookjs/addon-svelte-csf/pull/48) Thanks [@shilman](https://github.com/shilman)! - Update yarn.lock
- [#48](https://github.com/storybookjs/addon-svelte-csf/pull/48) Thanks [@shilman](https://github.com/shilman)! - Add auto release workflow

## 1.1.0

### Minor Changes

- [#30](https://github.com/storybookjs/addon-svelte-csf/pull/30) Thanks [@TheComputerM](https://github.com/TheComputerM) [@shilman](https://github.com/shilman)! - Add ESM support

## 1.0.1

### Patch Changes

- [#7](https://github.com/storybookjs/addon-svelte-csf/pull/7) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Fix main and browser field in package.json
- [#20](https://github.com/storybookjs/addon-svelte-csf/pull/20) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Add Types definition
- [#21](https://github.com/storybookjs/addon-svelte-csf/pull/21) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Fix duplicated exported id
- [#19](https://github.com/storybookjs/addon-svelte-csf/pull/19) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Upgrade dependencies (Storybook v6.2.1)
- [#13](https://github.com/storybookjs/addon-svelte-csf/pull/13) Thanks [@frederikhors](https://github.com/frederikhors)! - Update README.md
- [#9](https://github.com/storybookjs/addon-svelte-csf/pull/9) Thanks [@shedali](https://github.com/shedali)! - updates readme
- Thanks [@shilman](https://github.com/shilman)! - Update yarn.lock

## 1.0.0

### Major Changes

- [#1](https://github.com/storybookjs/addon-svelte-csf/pull/1) Thanks [@j3rem1e](https://github.com/j3rem1e)! - Svelte CSF Stories

### Patch Changes

- [#3](https://github.com/storybookjs/addon-svelte-csf/pull/3) Thanks [@shilman](https://github.com/shilman)! - Fix publish config
- [#2](https://github.com/storybookjs/addon-svelte-csf/pull/2) Thanks [@shilman](https://github.com/shilman)! - Add yarn.lock
- Thanks [@phated](https://github.com/phated)! - Initial commit
