# v5.0.5 (Thu Jul 03 2025)

#### 🐛 Bug Fix

- Fix reading `rawCode` from undefined `__svelteCsf` [#319](https://github.com/storybookjs/addon-svelte-csf/pull/319) ([@JReinhold](https://github.com/JReinhold))

#### Authors: 1

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))

---

# v5.0.4 (Tue Jun 24 2025)

#### 🐛 Bug Fix

- Add `'play-fn'`-tag to stories with play-functions [#317](https://github.com/storybookjs/addon-svelte-csf/pull/317) ([@JReinhold](https://github.com/JReinhold))

#### Authors: 1

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))

---

# v5.0.3 (Wed May 28 2025)

#### 🐛 Bug Fix

- Drop support for 9.0.0 prereleases, add support for 9.1.0 prereleases [#312](https://github.com/storybookjs/addon-svelte-csf/pull/312) ([@JReinhold](https://github.com/JReinhold))

#### Authors: 1

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))

---

# v5.0.2 (Wed May 28 2025)

#### 🐛 Bug Fix

- fix: Prevent exported runtime stories from colliding with story names [#310](https://github.com/storybookjs/addon-svelte-csf/pull/310) ([@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold))

#### Authors: 2

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))
- Mateusz Kadlubowski ([@xeho91](https://github.com/xeho91))

---

# v5.0.1 (Sun May 18 2025)

#### 🐛 Bug Fix

- fix: Allow user-defined local variable `meta` in stories [#309](https://github.com/storybookjs/addon-svelte-csf/pull/309) ([@xeho91](https://github.com/xeho91))

#### Authors: 1

- Mateusz Kadlubowski ([@xeho91](https://github.com/xeho91))

---

# v5.0.0 (Tue May 06 2025)

### Release Notes

#### Breaking: Add support for `render` in `defineMeta`, replacing `setTemplate`-function ([#295](https://github.com/storybookjs/addon-svelte-csf/pull/295))

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

#### Breaking: Rename `children` prop to `template`, require `asChild` for static stories ([#228](https://github.com/storybookjs/addon-svelte-csf/pull/228))

This release contains breaking changes related to the `children`-API. The legacy API stays as-is to maintain backwards compatibility.

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

#### Require Storybook 8.2.0 and above, support Storybook 9.0.0 prereleases ([#284](https://github.com/storybookjs/addon-svelte-csf/pull/284))

The addon now requires Storybook `8.2.0` and upwards (was previously 8.0.0), and has a peer dependency on the `storybook`-package. That package should always be in your project anyway though.

---

#### 💥 Breaking Change

- Breaking: Add support for `render` in `defineMeta`, replacing `setTemplate`-function [#295](https://github.com/storybookjs/addon-svelte-csf/pull/295) ([@JReinhold](https://github.com/JReinhold))
- Breaking: Rename `children` prop to `template`, require `asChild` for static stories [#228](https://github.com/storybookjs/addon-svelte-csf/pull/228) ([@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold))
- Require Storybook 8.2.0 and above, support Storybook 9.0.0 prereleases [#284](https://github.com/storybookjs/addon-svelte-csf/pull/284) ([@ndelangen](https://github.com/ndelangen))
- Fix missing `@storybook/docs-tools` dependency [#190](https://github.com/storybookjs/addon-svelte-csf/pull/190) ([@JReinhold](https://github.com/JReinhold))
- Experimental support for Svelte 5 [#181](https://github.com/storybookjs/addon-svelte-csf/pull/181) ([@tsar-boomba](https://github.com/tsar-boomba) [@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold) [@benoitf](https://github.com/benoitf))

#### 🚀 Enhancement

- Add `'svelte-csf'` tag to all Svelte CSF stories [#297](https://github.com/storybookjs/addon-svelte-csf/pull/297) ([@JReinhold](https://github.com/JReinhold))
- Dependencies: Support canaries and Storybook 9 prereleases [#281](https://github.com/storybookjs/addon-svelte-csf/pull/281) ([@ndelangen](https://github.com/ndelangen))
- Restore & add support for legacy syntax [#186](https://github.com/storybookjs/addon-svelte-csf/pull/186) ([@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold))

#### 🐛 Bug Fix

- Fix types [#302](https://github.com/storybookjs/addon-svelte-csf/pull/302) ([@JReinhold](https://github.com/JReinhold) [@xeho91](https://github.com/xeho91))
- Cleanup button example [#299](https://github.com/storybookjs/addon-svelte-csf/pull/299) ([@JReinhold](https://github.com/JReinhold))
- Fix Story `children` not overriding `args.children` [#298](https://github.com/storybookjs/addon-svelte-csf/pull/298) ([@JReinhold](https://github.com/JReinhold))
- Fix not working with `getAbsolutePath` [#296](https://github.com/storybookjs/addon-svelte-csf/pull/296) ([@JReinhold](https://github.com/JReinhold))
- Fix tags Story-level tags not having an effect in Vitest integration [#266](https://github.com/storybookjs/addon-svelte-csf/pull/266) ([@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold))
- fix: Temporarily disable save from UI feature [#285](https://github.com/storybookjs/addon-svelte-csf/pull/285) ([@xeho91](https://github.com/xeho91))
- Revert "upgrade to sb9 alpha" [#283](https://github.com/storybookjs/addon-svelte-csf/pull/283) ([@ndelangen](https://github.com/ndelangen))
- upgrade to sb9 alpha [#282](https://github.com/storybookjs/addon-svelte-csf/pull/282) ([@ndelangen](https://github.com/ndelangen))
- Internal: Add Visual Tests addon [#269](https://github.com/storybookjs/addon-svelte-csf/pull/269) ([@JReinhold](https://github.com/JReinhold))
- Fix legacy API template hook not running before Svelte in Vitest [#264](https://github.com/storybookjs/addon-svelte-csf/pull/264) ([@JReinhold](https://github.com/JReinhold))
- Fix badly formatted ESM that was breaking Node 22 and 23 [#260](https://github.com/storybookjs/addon-svelte-csf/pull/260) ([@JReinhold](https://github.com/JReinhold))
- fix: properly transform invalid identifiers [#246](https://github.com/storybookjs/addon-svelte-csf/pull/246) ([@paoloricciuti](https://github.com/paoloricciuti))
- Pre-optimize internal modules [#248](https://github.com/storybookjs/addon-svelte-csf/pull/248) ([@JReinhold](https://github.com/JReinhold))
- refactor: Stop using @storybook/client-logger [#247](https://github.com/storybookjs/addon-svelte-csf/pull/247) ([@JReinhold](https://github.com/JReinhold))
- refactor(transform)!: `meta` no longer destructurable from `defineMeta()` call [#244](https://github.com/storybookjs/addon-svelte-csf/pull/244) ([@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold))
- fix: Support for legacy `source` prop when value is `TemplateLiteral` [#245](https://github.com/storybookjs/addon-svelte-csf/pull/245) ([@xeho91](https://github.com/xeho91))
- Simplify imports [#243](https://github.com/storybookjs/addon-svelte-csf/pull/243) ([@JReinhold](https://github.com/JReinhold))
- fix: Prevent parser indexer not letting other addon errors to throw [#242](https://github.com/storybookjs/addon-svelte-csf/pull/242) ([@xeho91](https://github.com/xeho91))
- chore: Remove Vite plugin `post` enforcement [#241](https://github.com/storybookjs/addon-svelte-csf/pull/241) ([@xeho91](https://github.com/xeho91))
- Support `@sveltejs/vite-plugin-svelte` v5 [#237](https://github.com/storybookjs/addon-svelte-csf/pull/237) ([@JReinhold](https://github.com/JReinhold))
- Support Vite 6 [#236](https://github.com/storybookjs/addon-svelte-csf/pull/236) ([@yannbf](https://github.com/yannbf))
- fix: Resolve existing type issues [#219](https://github.com/storybookjs/addon-svelte-csf/pull/219) ([@xeho91](https://github.com/xeho91))
- Upgrade version ranges - drop support for Svelte 5 prereleases [#225](https://github.com/storybookjs/addon-svelte-csf/pull/225) ([@xeho91](https://github.com/xeho91))
- fix: `parameters` attribute from legacy `<Story>` being removed [#224](https://github.com/storybookjs/addon-svelte-csf/pull/224) ([@xeho91](https://github.com/xeho91))
- Fix errors at `enhanceRollupError` in Vite [#222](https://github.com/storybookjs/addon-svelte-csf/pull/222) ([@JReinhold](https://github.com/JReinhold))
- refactor: Replace deprecated `context="module"` with `module` [#217](https://github.com/storybookjs/addon-svelte-csf/pull/217) ([@xeho91](https://github.com/xeho91))
- fix(pre-transform): Move stories target component import declaration from instance to module tag [#218](https://github.com/storybookjs/addon-svelte-csf/pull/218) ([@xeho91](https://github.com/xeho91))
- v5: Fix tags being ignored [#206](https://github.com/storybookjs/addon-svelte-csf/pull/206) ([@JReinhold](https://github.com/JReinhold))
- fix(parser): Resolve `autodocs` tag issue and extracting `rawCode` [#201](https://github.com/storybookjs/addon-svelte-csf/pull/201) ([@xeho91](https://github.com/xeho91))
- Replace lodash usage with es-toolkit [#192](https://github.com/storybookjs/addon-svelte-csf/pull/192) ([@JReinhold](https://github.com/JReinhold))
- chore: use dist folder to load the files [#185](https://github.com/storybookjs/addon-svelte-csf/pull/185) ([@benoitf](https://github.com/benoitf))

#### 🏠 Internal

- Resolve merge conflicts between `main` and `next` [#305](https://github.com/storybookjs/addon-svelte-csf/pull/305) ([@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold) [@ndelangen](https://github.com/ndelangen) [@storybook-bot](https://github.com/storybook-bot) [@valentinpalkovic](https://github.com/valentinpalkovic) [@bichikim](https://github.com/bichikim) [@rChaoz](https://github.com/rChaoz) [@yannbf](https://github.com/yannbf))
- chore(deps): Remove unused `svelte-preprocess` [#300](https://github.com/storybookjs/addon-svelte-csf/pull/300) ([@xeho91](https://github.com/xeho91))
- ci(ESLint): Migrate to flat config & reconfigure [#291](https://github.com/storybookjs/addon-svelte-csf/pull/291) ([@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold))
- Add formatting check to CI [#293](https://github.com/storybookjs/addon-svelte-csf/pull/293) ([@JReinhold](https://github.com/JReinhold))
- Add `@storybook/experimental-addon-test` to repo (internal) [#263](https://github.com/storybookjs/addon-svelte-csf/pull/263) ([@JReinhold](https://github.com/JReinhold))
- refactor: Improve AST-related types readability & fix existing issues [#209](https://github.com/storybookjs/addon-svelte-csf/pull/209) ([@xeho91](https://github.com/xeho91))

#### 📝 Documentation

- Remove workarounds for Svelte TS snippet bug [#303](https://github.com/storybookjs/addon-svelte-csf/pull/303) ([@JReinhold](https://github.com/JReinhold))
- Fix `asChild` link in ERRORS.md [#292](https://github.com/storybookjs/addon-svelte-csf/pull/292) ([@JReinhold](https://github.com/JReinhold))

#### 🧪 Tests

- chore: Upgrade `vitest` and `vite` dependencies & `jsdom` -> `happy-dom` [#230](https://github.com/storybookjs/addon-svelte-csf/pull/230) ([@xeho91](https://github.com/xeho91) [@JReinhold](https://github.com/JReinhold))

#### Authors: 12

- Bichi Kim ([@bichikim](https://github.com/bichikim))
- Florent BENOIT ([@benoitf](https://github.com/benoitf))
- Isaiah Gamble ([@tsar-boomba](https://github.com/tsar-boomba))
- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))
- Matei Trandafir ([@rChaoz](https://github.com/rChaoz))
- Mateusz Kadlubowski ([@xeho91](https://github.com/xeho91))
- Norbert de Langen ([@ndelangen](https://github.com/ndelangen))
- Paolo Ricciuti ([@paoloricciuti](https://github.com/paoloricciuti))
- Steve Lee ([@SteveALee](https://github.com/SteveALee))
- Storybook Bot ([@storybook-bot](https://github.com/storybook-bot))
- Valentin Palkovic ([@valentinpalkovic](https://github.com/valentinpalkovic))
- Yann Braga ([@yannbf](https://github.com/yannbf))

---

# v4.2.0 (Thu Nov 28 2024)

#### 🚀 Enhancement

- Support Vite 6 [#235](https://github.com/storybookjs/addon-svelte-csf/pull/235) ([@yannbf](https://github.com/yannbf))

#### Authors: 1

- Yann Braga ([@yannbf](https://github.com/yannbf))

---

# v4.1.7 (Sun Sep 01 2024)

#### 🐛 Bug Fix

- Add support for story-level tags [#207](https://github.com/storybookjs/addon-svelte-csf/pull/207) ([@JReinhold](https://github.com/JReinhold))

#### Authors: 1

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))

---

# v4.1.6 (Thu Aug 22 2024)

#### 🐛 Bug Fix

- Update indexer.ts [#193](https://github.com/storybookjs/addon-svelte-csf/pull/193) ([@bichikim](https://github.com/bichikim) [@JReinhold](https://github.com/JReinhold))

#### Authors: 2

- Bichi Kim ([@bichikim](https://github.com/bichikim))
- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))

---

# v4.1.5 (Tue Aug 06 2024)

#### 🐛 Bug Fix

- Fix type errors due to imports from @storybook/types [#198](https://github.com/storybookjs/addon-svelte-csf/pull/198) ([@rChaoz](https://github.com/rChaoz))

#### Authors: 1

- Matei Trandafir ([@rChaoz](https://github.com/rChaoz))

---

# v4.1.4 (Tue Jul 09 2024)

#### 🐛 Bug Fix

- fix: Allow 8.2.0-beta.0 peer dependency of @storybook/svelte [#187](https://github.com/storybookjs/addon-svelte-csf/pull/187) ([@valentinpalkovic](https://github.com/valentinpalkovic))

#### Authors: 1

- Valentin Palkovic ([@valentinpalkovic](https://github.com/valentinpalkovic))

---

# v4.1.3 (Thu May 16 2024)

#### 🐛 Bug Fix

- Fix dependency on `@storybook/node-logger` and `@storybook/client-logger` [#182](https://github.com/storybookjs/addon-svelte-csf/pull/182) ([@ndelangen](https://github.com/ndelangen))

#### 🔩 Dependency Updates

- chore: Remove `fs-extra` in favor of `node:fs` [#179](https://github.com/storybookjs/addon-svelte-csf/pull/179) ([@xeho91](https://github.com/xeho91))
- Update `pnpm` to `v9` & improve CI [#180](https://github.com/storybookjs/addon-svelte-csf/pull/180) ([@xeho91](https://github.com/xeho91))

#### Authors: 2

- Mateusz Kadlubowski ([@xeho91](https://github.com/xeho91))
- Norbert de Langen ([@ndelangen](https://github.com/ndelangen))

---

# v4.1.2 (Wed Mar 06 2024)

#### 🐛 Bug Fix

- Support Storybook 8 [#165](https://github.com/storybookjs/addon-svelte-csf/pull/165) ([@JReinhold](https://github.com/JReinhold))

#### ⚠️ Pushed to `main`

- Upgrade auto ([@JReinhold](https://github.com/JReinhold))
- Support Storybook 8 ([@JReinhold](https://github.com/JReinhold))
- Merge branch 'next' ([@JReinhold](https://github.com/JReinhold))

#### 📝 Documentation

- Update README.md [#173](https://github.com/storybookjs/addon-svelte-csf/pull/173) ([@LuisEGR](https://github.com/LuisEGR))

#### Authors: 2

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))
- Luis E. González ([@LuisEGR](https://github.com/LuisEGR))

---

# v4.1.1 (Wed Jan 31 2024)

#### 🐛 Bug Fix

- Fix play function not running in the component scope [#169](https://github.com/storybookjs/addon-svelte-csf/pull/169) ([@j3rem1e](https://github.com/j3rem1e))

#### ⚠️ Pushed to `main`

- Set git user in release action ([@JReinhold](https://github.com/JReinhold))

#### Authors: 2

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))
- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.1.0 (Fri Dec 29 2023)

#### 🚀 Enhancement

- Update versions of peer dependencies to allow latest Vite and Vite Svelte plugin [#159](https://github.com/storybookjs/addon-svelte-csf/pull/159) ([@joekrump](https://github.com/joekrump))

#### Authors: 1

- Joe Krump ([@joekrump](https://github.com/joekrump))

---

# v4.0.13 (Tue Nov 21 2023)

#### 🐛 Bug Fix

- Add component description from jsdoc on meta export [#158](https://github.com/storybookjs/addon-svelte-csf/pull/158) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.12 (Fri Nov 17 2023)

#### 🐛 Bug Fix

- Exports package.json [#157](https://github.com/storybookjs/addon-svelte-csf/pull/157) ([@tylergaw](https://github.com/tylergaw))

#### Authors: 1

- Tyler Gaw ([@tylergaw](https://github.com/tylergaw))

---

# v4.0.11 (Fri Nov 10 2023)

#### 🐛 Bug Fix

- Parse comments as Story description [#154](https://github.com/storybookjs/addon-svelte-csf/pull/154) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.10 (Thu Nov 09 2023)

#### 🐛 Bug Fix

- Update src/preset/indexer.ts [#153](https://github.com/storybookjs/addon-svelte-csf/pull/153) ([@benmccann](https://github.com/benmccann))
- Add support for experimental_indexers [#153](https://github.com/storybookjs/addon-svelte-csf/pull/153) ([@j3rem1e](https://github.com/j3rem1e))
- Upgrade dev dependencies to Storybook v7.5.2 and Svelte 4.2.2 [#153](https://github.com/storybookjs/addon-svelte-csf/pull/153) ([@j3rem1e](https://github.com/j3rem1e))

#### 📝 Documentation

- Updated Readme to include component [#150](https://github.com/storybookjs/addon-svelte-csf/pull/150) ([@brittneypostma](https://github.com/brittneypostma))

#### Authors: 3

- Ben McCann ([@benmccann](https://github.com/benmccann))
- Brittney Postma ([@brittneypostma](https://github.com/brittneypostma))
- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.9 (Sat Sep 23 2023)

#### 🐛 Bug Fix

- Fix reactivity of args when HMR remount the RenderContext [#144](https://github.com/storybookjs/addon-svelte-csf/pull/144) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.8 (Thu Sep 21 2023)

#### 🐛 Bug Fix

- Fix forwarding of actions handlers [#142](https://github.com/storybookjs/addon-svelte-csf/pull/142) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.7 (Sat Sep 16 2023)

#### 🐛 Bug Fix

- Update src/parser/extract-stories.ts [#134](https://github.com/storybookjs/addon-svelte-csf/pull/134) ([@benmccann](https://github.com/benmccann))
- Allow 'meta' to be exported as const from module script [#134](https://github.com/storybookjs/addon-svelte-csf/pull/134) ([@j3rem1e](https://github.com/j3rem1e))
- Supports for tags in <Meta/> [#134](https://github.com/storybookjs/addon-svelte-csf/pull/134) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 2

- Ben McCann ([@benmccann](https://github.com/benmccann))
- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.6 (Fri Sep 15 2023)

#### 🐛 Bug Fix

- Allow configuration of filename patterns besides \*.stories.svelte [#140](https://github.com/storybookjs/addon-svelte-csf/pull/140) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.5 (Wed Sep 13 2023)

#### 🐛 Bug Fix

- fix: MetaProps typing [#139](https://github.com/storybookjs/addon-svelte-csf/pull/139) ([@paoloricciuti](https://github.com/paoloricciuti))

#### Authors: 1

- Paolo Ricciuti ([@paoloricciuti](https://github.com/paoloricciuti))

---

# v4.0.4 (Wed Sep 13 2023)

#### 🐛 Bug Fix

- fix: move MetaProps to its own declaration to allow for overrides [#138](https://github.com/storybookjs/addon-svelte-csf/pull/138) ([@paoloricciuti](https://github.com/paoloricciuti))

#### Authors: 1

- Paolo Ricciuti ([@paoloricciuti](https://github.com/paoloricciuti))

---

# v4.0.3 (Sat Sep 02 2023)

#### 🐛 Bug Fix

- Fix test snapshots [#137](https://github.com/storybookjs/addon-svelte-csf/pull/137) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.2 (Sat Sep 02 2023)

#### 🐛 Bug Fix

- [Bug] titlePrefix in advanced story specifiers causes the story to crash with "Didn't find 'xyz' in CSF file" [#136](https://github.com/storybookjs/addon-svelte-csf/pull/136) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.1 (Thu Aug 31 2023)

#### 🐛 Bug Fix

- Fix svelte-stories-loader in Windows [#133](https://github.com/storybookjs/addon-svelte-csf/pull/133) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v4.0.0 (Tue Aug 29 2023)

#### 💥 Breaking Change

- Require Svelte v4, vite-plugin-svelte v2, Vite v4 [#128](https://github.com/storybookjs/addon-svelte-csf/pull/128) ([@JReinhold](https://github.com/JReinhold))

#### Authors: 1

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))

---

# v3.0.10 (Tue Aug 29 2023)

#### 🐛 Bug Fix

- Fix: `typeof Meta` in Svelte v3 (Pin Svelte peer dependency to v3) [#127](https://github.com/storybookjs/addon-svelte-csf/pull/127) ([@JReinhold](https://github.com/JReinhold))

#### Authors: 1

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))

---

# v3.0.9 (Wed Aug 23 2023)

#### 🐛 Bug Fix

- Fix export condition [#125](https://github.com/storybookjs/addon-svelte-csf/pull/125) ([@benmccann](https://github.com/benmccann))

#### Authors: 1

- Ben McCann ([@benmccann](https://github.com/benmccann))

---

# v3.0.8 (Wed Aug 23 2023)

#### 🐛 Bug Fix

- docs: remove broken link [#126](https://github.com/storybookjs/addon-svelte-csf/pull/126) ([@benmccann](https://github.com/benmccann))

#### Authors: 1

- Ben McCann ([@benmccann](https://github.com/benmccann))

---

# v3.0.7 (Tue Aug 01 2023)

#### 🐛 Bug Fix

- Fix missing types by adding back `main` and `types` fields [#118](https://github.com/storybookjs/addon-svelte-csf/pull/118) ([@hobbes7878](https://github.com/hobbes7878))

#### Authors: 1

- Jon McClure ([@hobbes7878](https://github.com/hobbes7878))

---

# v3.0.6 (Tue Aug 01 2023)

#### 🐛 Bug Fix

- fix: swap order of types to avoid module not found [#115](https://github.com/storybookjs/addon-svelte-csf/pull/115) ([@paoloricciuti](https://github.com/paoloricciuti))

#### Authors: 1

- Paolo Ricciuti ([@paoloricciuti](https://github.com/paoloricciuti))

---

# v3.0.5 (Mon Jul 31 2023)

#### 🐛 Bug Fix

- Fix generated ESM, revamp build system [#113](https://github.com/storybookjs/addon-svelte-csf/pull/113) ([@hobbes7878](https://github.com/hobbes7878))

#### Authors: 1

- Jon McClure ([@hobbes7878](https://github.com/hobbes7878))

---

# v3.0.4 (Wed Jul 19 2023)

#### 🐛 Bug Fix

- Update dependencies to support svelte@4 [#112](https://github.com/storybookjs/addon-svelte-csf/pull/112) ([@RSWilli](https://github.com/RSWilli))

#### Authors: 1

- Wilhelm Bartel ([@RSWilli](https://github.com/RSWilli))

---

# v3.0.3 (Fri Jun 09 2023)

#### 🐛 Bug Fix

- types: use `WebRenderer` type as new `Addon_BaseAnnotations` template variable [#106](https://github.com/storybookjs/addon-svelte-csf/pull/106) ([@specialdoom](https://github.com/specialdoom))

#### Authors: 1

- specialdoom ([@specialdoom](https://github.com/specialdoom))

---

# v3.0.2 (Fri Apr 21 2023)

#### 🐛 Bug Fix

- Fix stories not re-rendering when args change in Controls [#99](https://github.com/storybookjs/addon-svelte-csf/pull/99) ([@leika](https://github.com/leika))

#### Authors: 1

- Stefan Marx ([@leika](https://github.com/leika))

---

# v3.0.1 (Wed Apr 12 2023)

#### 🐛 Bug Fix

- fix: imports on index.d.ts file [#100](https://github.com/storybookjs/addon-svelte-csf/pull/100) ([@andrescera](https://github.com/andrescera))

#### Authors: 1

- [@andrescera](https://github.com/andrescera)

---

# v3.0.0 (Mon Apr 03 2023)

#### 💥 Breaking Change

- Expand Storybook version range [#95](https://github.com/storybookjs/addon-svelte-csf/pull/95) ([@JReinhold](https://github.com/JReinhold))
- Require Storybook v7 in v3 [#81](https://github.com/storybookjs/addon-svelte-csf/pull/81) ([@JReinhold](https://github.com/JReinhold))
- Story Indexer [#77](https://github.com/storybookjs/addon-svelte-csf/pull/77) ([@JReinhold](https://github.com/JReinhold))

#### 🐛 Bug Fix

- fix: preprocess svelte file during indexing [#94](https://github.com/storybookjs/addon-svelte-csf/pull/94) ([@ysaskia](https://github.com/ysaskia))
- Support newest ESM-only `@sveltejs/vite-plugin` [#84](https://github.com/storybookjs/addon-svelte-csf/pull/84) ([@JReinhold](https://github.com/JReinhold))
- Add vite support [#72](https://github.com/storybookjs/addon-svelte-csf/pull/72) ([@IanVS](https://github.com/IanVS))

#### Authors: 3

- Ian VanSchooten ([@IanVS](https://github.com/IanVS))
- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))
- Yoann ([@ysaskia](https://github.com/ysaskia))

---

# v2.0.11 (Tue Jan 17 2023)

#### 🐛 Bug Fix

- Make types compatible with TypeScript `strict` mode [#74](https://github.com/storybookjs/addon-svelte-csf/pull/74) ([@RSWilli](https://github.com/RSWilli))

#### Authors: 1

- Wilhelm Bartel ([@RSWilli](https://github.com/RSWilli))

---

# v2.0.10 (Thu Oct 27 2022)

#### 🐛 Bug Fix

- Revert "Implement a Svelte StoryIndexer" #76 [#76](https://github.com/storybookjs/addon-svelte-csf/pull/76) ([@JReinhold](https://github.com/JReinhold))

#### Authors: 1

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))

---

# v2.0.9 (Thu Oct 27 2022)

#### 🐛 Bug Fix

- Implement a Svelte StoryIndexer [#69](https://github.com/storybookjs/addon-svelte-csf/pull/69) ([@j3rem1e](https://github.com/j3rem1e) [@JReinhold](https://github.com/JReinhold))

#### Authors: 2

- Jeppe Reinhold ([@JReinhold](https://github.com/JReinhold))
- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v2.0.8 (Mon Oct 03 2022)

#### 🐛 Bug Fix

- Upgrade jest to 29 [#71](https://github.com/storybookjs/addon-svelte-csf/pull/71) ([@IanVS](https://github.com/IanVS))

#### Authors: 1

- Ian VanSchooten ([@IanVS](https://github.com/IanVS))

---

# v2.0.7 (Fri Aug 12 2022)

#### 🐛 Bug Fix

- update description [#66](https://github.com/storybookjs/addon-svelte-csf/pull/66) ([@benmccann](https://github.com/benmccann))

#### Authors: 1

- Ben McCann ([@benmccann](https://github.com/benmccann))

---

# v2.0.6 (Thu Jul 14 2022)

#### 🐛 Bug Fix

- remove transitive dependencies from peerDependencies [#63](https://github.com/storybookjs/addon-svelte-csf/pull/63) ([@benmccann](https://github.com/benmccann))
- Add a link to native format example [#61](https://github.com/storybookjs/addon-svelte-csf/pull/61) ([@benmccann](https://github.com/benmccann))

#### Authors: 1

- Ben McCann ([@benmccann](https://github.com/benmccann))

---

# v2.0.5 (Thu Jul 07 2022)

#### 🐛 Bug Fix

- Make `svelte-loader` optional [#62](https://github.com/storybookjs/addon-svelte-csf/pull/62) ([@benmccann](https://github.com/benmccann))

#### Authors: 1

- Ben McCann ([@benmccann](https://github.com/benmccann))

---

# v2.0.4 (Thu May 19 2022)

#### 🐛 Bug Fix

- Remove React from peerDependencies [#58](https://github.com/storybookjs/addon-svelte-csf/pull/58) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v2.0.3 (Wed Apr 20 2022)

#### 🐛 Bug Fix

- Update peerdependencies to work with sb@next [#56](https://github.com/storybookjs/addon-svelte-csf/pull/56) ([@francoisromain](https://github.com/francoisromain))

#### Authors: 1

- François Romain ([@francoisromain](https://github.com/francoisromain))

---

# v2.0.2 (Sun Apr 17 2022)

#### 🐛 Bug Fix

- Fix names with special char at end [#55](https://github.com/storybookjs/addon-svelte-csf/pull/55) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v2.0.1 (Fri Apr 08 2022)

#### 🐛 Bug Fix

- Remove knobs references [#49](https://github.com/storybookjs/addon-svelte-csf/pull/49) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v2.0.0 (Fri Apr 08 2022)

#### 💥 Breaking Change

- Upgrade dependencies [#42](https://github.com/storybookjs/addon-svelte-csf/pull/42) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v1.1.2 (Fri Apr 08 2022)

#### 🐛 Bug Fix

- Allow a Story to access its context [#47](https://github.com/storybookjs/addon-svelte-csf/pull/47) ([@j3rem1e](https://github.com/j3rem1e))

#### Authors: 1

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))

---

# v1.1.1 (Fri Apr 08 2022)

#### 🐛 Bug Fix

- Fix generated id [#43](https://github.com/storybookjs/addon-svelte-csf/pull/43) ([@j3rem1e](https://github.com/j3rem1e))
- Update yarn.lock [#48](https://github.com/storybookjs/addon-svelte-csf/pull/48) ([@shilman](https://github.com/shilman))
- Add auto release workflow [#48](https://github.com/storybookjs/addon-svelte-csf/pull/48) ([@shilman](https://github.com/shilman))

#### Authors: 2

- Jérémie ([@j3rem1e](https://github.com/j3rem1e))
- Michael Shilman ([@shilman](https://github.com/shilman))

---

# v1.1.0 (Thu Jun 10 2021)

#### 🚀 Enhancement

- Add ESM support [#30](https://github.com/storybookjs/addon-svelte-csf/pull/30) ([@TheComputerM](https://github.com/TheComputerM) [@shilman](https://github.com/shilman))

#### Authors: 2

- Michael Shilman ([@shilman](https://github.com/shilman))
- TheComputerM ([@TheComputerM](https://github.com/TheComputerM))

---

# v1.0.1 (Wed Jun 09 2021)

#### 🐛 Bug Fix

- Fix main and browser field in package.json [#7](https://github.com/storybookjs/addon-svelte-csf/pull/7) ([@j3rem1e](https://github.com/j3rem1e))
- Add Types definition [#20](https://github.com/storybookjs/addon-svelte-csf/pull/20) ([@j3rem1e](https://github.com/j3rem1e))
- Fix duplicated exported id [#21](https://github.com/storybookjs/addon-svelte-csf/pull/21) ([@j3rem1e](https://github.com/j3rem1e))
- Upgrade dependencies (Storybook v6.2.1) [#19](https://github.com/storybookjs/addon-svelte-csf/pull/19) ([@j3rem1e](https://github.com/j3rem1e))
- Update README.md [#13](https://github.com/storybookjs/addon-svelte-csf/pull/13) ([@frederikhors](https://github.com/frederikhors))
- updates readme [#9](https://github.com/storybookjs/addon-svelte-csf/pull/9) ([@shedali](https://github.com/shedali))

#### ⚠️ Pushed to `main`

- Update yarn.lock ([@shilman](https://github.com/shilman))

#### Authors: 4

- [@frederikhors](https://github.com/frederikhors)
- Jérémie ([@j3rem1e](https://github.com/j3rem1e))
- Michael Shilman ([@shilman](https://github.com/shilman))
- shedali ([@shedali](https://github.com/shedali))

---

# v1.0.0 (Sat Mar 06 2021)

#### 💥 Breaking Change

- Svelte CSF Stories [#1](https://github.com/storybookjs/addon-svelte-csf/pull/1) ([@j3rem1e](https://github.com/j3rem1e))

#### 🐛 Bug Fix

- Fix publish config [#3](https://github.com/storybookjs/addon-svelte-csf/pull/3) ([@shilman](https://github.com/shilman))
- Add yarn.lock [#2](https://github.com/storybookjs/addon-svelte-csf/pull/2) ([@shilman](https://github.com/shilman))

#### ⚠️ Pushed to `main`

- Initial commit ([@phated](https://github.com/phated))

#### Authors: 3

- Blaine Bublitz ([@phated](https://github.com/phated))
- Jérémie ([@j3rem1e](https://github.com/j3rem1e))
- Michael Shilman ([@shilman](https://github.com/shilman))
