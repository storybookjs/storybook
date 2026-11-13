Two independent causes seen with `storybook dev` after the upgrade (core-dev-server-as-upgraded.log):
1. Mixed versions: the `storybook` CLI resolves to the hoisted root copy 10.6.3 (root node_modules/storybook), while packages/twenty-front resolves @storybook/react-vite 11.0.0-beta.2. The 10.6.3 CLI fails with SB_CORE-SERVER_0002 loading ./node_modules/@storybook/react-vite/preset. Root cause: the root `storybook` is pinned ^10.6.3 by packages/twenty-ui and packages/twenty-front-component-renderer, and twenty-front does not list `storybook` itself.
2. @storybook-community/storybook-addon-cookie 5.0.2 (bumped from 5.0.0 by the upgrade): its root preset.js re-exports ./dist/preset.js, which is not in the published dist/ (only chunk, index, manager, preview). Error: Cannot find module .../dist/preset.js.

3. After the workarounds above, storybook dev fails with SB_CORE-SERVER_0004 (NoMatchingExportError) during buildOrThrow (debug-storybook.log). packages/twenty-front/.storybook/main.ts lists '@storybook/addon-vitest', but packages/twenty-front/package.json does not declare it, so the upgrade did not bump it. The hoisted root copy 10.6.3 (declared by packages/twenty-ui and packages/twenty-front-component-renderer) resolves instead, and mixes with the 11 core.
   Fix tried: add @storybook/addon-vitest@11.0.0-beta.2 as a direct devDependency of packages/twenty-front.

4. Real remaining cause of SB_CORE-SERVER_0004: storybook-addon-mock-date 3.2.1 (bumped from 2.0.0 by the upgrade; peer storybook ^10.0.0). Its dist/preview.js does `import { PreviewAddon } from "storybook/internal/csf"`, and storybook 11.0.0-beta.2 has no runtime export PreviewAddon (checked with node import of storybook/internal/csf: PreviewAddon=false). The loader reports only SB_CORE-SERVER_0004 and does not name the addon.
   Fix tried: pin storybook-addon-mock-date back to 2.0.0 in packages/twenty-front/package.json.

Correction to item 3: adding @storybook/addon-vitest@11.0.0-beta.2 did not change the error. The NoMatchingExportError stopped only after item 4 was fixed, so item 3 is not a confirmed cause. The addon is kept as a direct dependency because main.ts lists it.
