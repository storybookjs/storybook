# core.dev-server: cause

File and line: `.storybook/main.ts:50` (written by the `story-sort-to-main` automigration during `storybook upgrade`).

Why it fails: the automigration copied the preview's `includeName: true` into `storySorts`. The 11.0.0-beta.5 type for a `storySorts` entry (`Addon_StorySortObjectParameter`, `node_modules/storybook/dist/chunk-DFmIV9A4.d.ts`) has `includeNames?: boolean` (plural). The Angular build type-checks `.storybook/main.ts` and fails with:

    ERROR in .storybook/main.ts:50:97 - error TS2353: Object literal may only specify known properties, and 'includeName' does not exist in type 'Addon_StorySortParameterV7$1'.

and then `Failed to build the preview` / `SB_BUILDER-WEBPACK5_0003`. The migration guide does not mention `includeName` (grep of MIGRATION.md is empty).

Fix tried: rename the key to `includeNames` in `.storybook/main.ts`. Recorded as a workaround in `unblock.md`.
