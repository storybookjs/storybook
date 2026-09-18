import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createMetaComponentResolver } from '../common/utils/resolve-meta-component.ts';
import { loadCsf, printCsf } from './CsfFile.ts';

const fileName = fileURLToPath(
  new URL('./__fixtures__/factory-meta/Button.stories.ts', import.meta.url)
);

describe('imported factory meta', () => {
  it.each([
    ['import sharedMeta from "./shared";', 'sharedMeta'],
    ['import { sharedMeta } from "./shared";', 'sharedMeta'],
    ['import * as shared from "./shared";', 'shared.sharedMeta'],
    ['import sharedMeta from "./reexport";', 'sharedMeta'],
    ['import { renamedMeta } from "./reexport";', 'renamedMeta'],
  ])('indexes metadata through %s', (importStatement, argument) => {
    const source = `
      import { config } from '#.storybook/preview';
      ${importStatement}
      const meta = config.meta(${argument});
      export const Primary = meta.story({});
      export const Excluded = meta.story({});
    `;
    const csf = loadCsf(source, { fileName, makeTitle: (title) => `Prefix/${title}` }).parse();

    expect(csf.meta).toMatchObject({
      title: 'Prefix/Shared/Button',
      id: 'shared-button',
      tags: ['test', 'shared-meta'],
      excludeStories: ['Excluded'],
    });
    expect(csf.indexInputs).toEqual([
      expect.objectContaining({
        exportName: 'Primary',
        title: 'Prefix/Shared/Button',
        __id: 'shared-button--primary',
        tags: ['test', 'shared-meta'],
      }),
    ]);
    expect(printCsf(csf).code).toBe(source);
    expect(createMetaComponentResolver()(csf, fileName)).toEqual({
      component: {
        localName: 'Button',
        exportName: 'Button',
        importId: './component.ts',
        path: fileURLToPath(new URL('./__fixtures__/factory-meta/component.ts', import.meta.url)),
      },
    });
  });
});
