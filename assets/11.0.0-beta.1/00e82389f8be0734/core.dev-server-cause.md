# core.dev-server: cause

1. Cookie addon preset (core.dev-server-preset-error.log). With `getAbsolutePath('@storybook-community/storybook-addon-cookie')` from the wrap-getAbsolutePath automigration, Storybook 11 loads `preset.js` at the package root. That file is `export * from './dist/preset.js'`, and dist/preset.js is absent in both 5.0.0 and 5.0.2 (checked with npm pack file lists). Workaround: the bare package name in .storybook/main.ts. Fixed by reverting that single entry.

2. `@storybook/addon-vitest` is not declared by packages/twenty-front. The hoisted root copy is 10.6.3 (pinned by packages/twenty-front-component-renderer/package.json). Its manager imports `experimental_UniversalStore` from storybook/manager-api, which 11 no longer exports (core.dev-server-manager-export-error.log). Workaround: declare `@storybook/addon-vitest` ^11.0.0-beta.1 in twenty-front devDependencies.

3. `storybook-addon-mock-date` 3.2.1, bumped by the upgrade from 2.0.0, manager imports `WithTooltip` from storybook/internal/components, which 11 removed (guide section "Deprecated addon UI APIs removed"). Workaround: pin storybook-addon-mock-date back to 2.0.0.
