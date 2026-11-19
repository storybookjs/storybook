# Cause: test-storybook crashes with previewConfig.getFieldValue is not a function

- File: node_modules/@storybook/test-runner/dist/test-storybook.js, line 19038 (function extractTagsFromPreview), version 0.26.1 (lockfile before the upgrade: 0.26.0).
- Code: `const previewConfig = await readConfig(previewConfigPath)` (readConfig from storybook/internal/csf-tools), then `previewConfig.getFieldValue(["tags"])`.
- Why it fails: Storybook 11.0.0-beta.3 readConfig returns a ConfigFile (storybook/dist/csf-tools/index.d.ts, class ConfigFile). It has no getFieldValue (zero matches in storybook/dist). Its value accessor is getValue(path).
- Fix tried: replace getFieldValue with getValue in that one call, keep the `?? []` fallback. Applied to the installed file under node_modules only.
