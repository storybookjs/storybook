# core.dev-server: dev server fails to build the manager UI

- File: packages/components/.storybook/main.ts, the `addons` list (the storybook-addon-rtl entry, originally line 13 after the upgrade).
- Failing module: node_modules/.pnpm/storybook-addon-rtl@3.0.2_storybook@11.0.0-beta.5_.../node_modules/storybook-addon-rtl/dist/manager.js:3:9
  `import { IconButton } from "storybook/internal/components";`
- Error (verbatim from dev-core.log): `✘ [ERROR] No matching export in "global-externals:storybook/internal/components" for import "IconButton"`
  `■  SB_CORE-SERVER_0004 (NoMatchingExportError)`
- Why it fails: storybook-addon-rtl@3.0.2 declares a peer range of Storybook ^10.0.0. Storybook 11 removed `IconButton` from `storybook/internal/components` (MIGRATION.md, section "Deprecated addon UI APIs removed"). `storybook doctor` reported the same package as incompatible ("depends on ^10") before the dev server started.
- Ownership: storybook-addon-rtl is a third-party package (not in the @storybook scope nor the storybookjs organization). It is not listed as broken in MIGRATION.md.
- Fix tried: removed the `getAbsolutePath("storybook-addon-rtl")` entry from the `addons` list in main.ts (workaround, commit "qa: unblock core.dev-server"). package.json was not changed.
- Result after the workaround: dev server ready on 127.0.0.1:6006, index.json lists 931 entries (same as baseline).
- Not tried: patching the addon under node_modules, or a newer addon release (none checked, no network lookups done).
