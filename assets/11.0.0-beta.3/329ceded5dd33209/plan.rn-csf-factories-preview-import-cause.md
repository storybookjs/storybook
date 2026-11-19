# plan.rn-csf-factories-preview-import: cause

- `apps/storybook-react-native/.rnstorybook/main.ts:1` after `storybook automigrate csf-factories --config-dir .rnstorybook --yes`:
  `import { defineMain } from '@storybook/your-framework-here/node';`
- `apps/storybook-react-native/.rnstorybook/preview.tsx:1` after the same codemod:
  `import { definePreview } from '@storybook/your-framework-here';`
- Why it fails: `@storybook/your-framework-here` is a placeholder name, not a published package. `yarn prestorybook` (`sb-rn-get-stories --config-path ./.rnstorybook`) fails with `MODULE_NOT_FOUND` at `.rnstorybook/main.ts:1`.
- Workaround tried: restore `.rnstorybook/main.ts` and `.rnstorybook/preview.tsx` to their pre-codemod content (`git checkout <upgrade commit> -- <both files>`), keep the story converts and the `package.json` imports map, rerun `prestorybook`.
