import { describe, expect, it } from 'vitest';

import { loadCsf } from './CsfFile';

const getIndex = (code: string) => {
  const inputs = loadCsf(code, { makeTitle: () => 'title', fileName: 'a.stories.ts' }).parse()
    .indexInputs;

  return {
    raw: inputs,
    entries: inputs.map((i) => i.name),
  };
};

describe('test fn', () => {
  it('indexes CSF v1 to v3 stories', () => {
    const { entries } = getIndex(
      `
          export default { component: 'foo' };
          export const CSF1 = () => 'foo';
          export const CSF2 = (args) => 'foo';
          export const CSF3 = {};
          export const CustomName = {
            name: 'Custom name',
          };
        `
    );
    expect(entries).toMatchInlineSnapshot(`
      [
        "CSF 1",
        "CSF 2",
        "CSF 3",
        "Custom name",
      ]
    `);
  });

  it('indexes test functions', () => {
    const { entries } = getIndex(
      `
          import { config } from '#.storybook/preview'
          const meta = config.meta({ component: 'foo' });
          export const A = meta.story({})
          A.test('async test function', async () => {})
          A.test('sync test function', () => {})
          A.test('with overrides', { args: { label: 'bar' } }, () => {})
          const reference = () => {}
          A.test('with function reference', reference)
        `
    );
    expect(entries).toMatchInlineSnapshot(`
      [
        "A",
        "async test function",
        "sync test function",
        "with overrides",
        "with function reference",
      ]
    `);
  });
});
