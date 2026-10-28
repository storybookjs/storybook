import { fileURLToPath } from 'node:url';

export const core = () => ({
  renderer: fileURLToPath(
    new URL(`../${process.env.STORYBOOK_FIXTURE_RENDERER}-renderer/preset.js`, import.meta.url)
  ),
});

export const previewAnnotations = (input = []) => [...input, '/framework-preview.ts'];
