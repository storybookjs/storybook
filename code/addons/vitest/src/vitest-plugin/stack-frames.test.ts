import { describe, expect, it } from 'vitest';

import { isStorybookInternalFrame } from './stack-frames.ts';

describe('isStorybookInternalFrame', () => {
  it.each([
    '/project/node_modules/storybook/dist/test/index.js',
    '/project/node_modules/storybook/dist/instrumenter/index.js',
    '/project/node_modules/storybook/dist/_browser-chunks/chunk-ORWLP677.js',
    '/project/node_modules/@storybook/addon-vitest/dist/vitest-plugin/test-utils.js',
    'C:\\project\\node_modules\\storybook\\dist\\instrumenter\\index.js',
    '/project/node_modules/.cache/storybook/10.6.0/hash/sb-vitest/deps/storybook_test.js',
    '/project/node_modules/.cache/storybook/10.6.0/hash/sb-vitest/deps/@storybook_addon-vitest_internal_test-utils.js?v=777b44a5',
  ])('filters out %s', (file) => {
    expect(isStorybookInternalFrame(file)).toBe(true);
  });

  it.each([
    '/project/src/stories/Page.stories.ts',
    '/project/src/stories/Page.tsx',
    '/project/.storybook/preview.ts',
    '/project/node_modules/@testing-library/dom/dist/index.js',
    '/project/node_modules/.cache/storybook/10.6.0/hash/sb-vitest/deps/react-dom_client.js',
    undefined,
  ])('keeps %s', (file) => {
    expect(isStorybookInternalFrame(file)).toBe(false);
  });
});
