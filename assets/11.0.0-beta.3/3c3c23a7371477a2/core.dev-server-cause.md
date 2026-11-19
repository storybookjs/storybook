# Cause: dev server fails after the automigration (story-sort-to-main)

File: .storybook/main.ts line 50 (written by the story-sort-to-main automigration, moved from preview.ts parameters.options.storySort).

Error (verbatim, from post-dev.log):
ERROR in .storybook/main.ts:50:97 - error TS2353: Object literal may only specify known properties, and 'includeName' does not exist in type 'Addon_StorySortParameterV7$1'.

Why: the automigration copied the key `includeName: true` into `storySorts`. The Storybook 11 type Addon_StorySortObjectParameter (node_modules/storybook/dist/chunk-TreilRja.d.ts) has `includeNames?: boolean` (plural) and no `includeName`. The webpack type check then fails and the preview build stops ("Broken build").
The baseline (Storybook 10.6.2) accepted the same key because parameters.options is typed loosely.

Fix tried (workaround): removed `includeName: true` from the storySorts entry in .storybook/main.ts. Runtime in 11 reads `includeNames` only (node_modules/storybook/dist/core-server/index.js:11997), so the removed key had no effect on sorting in 11.
