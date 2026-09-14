import { describe, expect, it } from 'vitest';

import { transformPreviewSource, transformStorySource } from './component-subtitle.ts';

describe('component-subtitle', () => {
  it('moves componentSubtitle to docs.subtitle in preview config', () => {
    expect(
      transformPreviewSource(`
        export default { parameters: { componentSubtitle: 'Legacy' } };
      `)
    ).toContain("subtitle: 'Legacy'");
  });

  it('moves componentSubtitle for meta and stories', () => {
    const transformed = transformStorySource(`
      export default { parameters: { componentSubtitle: 'Meta' } };
      export const Primary = {
        parameters: { componentSubtitle: 'Story' }
      };
    `);

    expect(transformed).toContain("subtitle: 'Meta'");
    expect(transformed).toContain("subtitle: 'Story'");
    expect(transformed).not.toContain('componentSubtitle');
  });

  it('moves componentSubtitle into an existing docs object', () => {
    expect(
      transformStorySource(`
        export default { parameters: {
          componentSubtitle: 'Legacy',
          docs: { source: { type: 'code' } }
        } };
      `)
    ).toContain("subtitle: 'Legacy'");
  });

  it('leaves unrelated source unchanged', () => {
    expect(
      transformStorySource(`
        export default { parameters: {} };
        export const Primary = { args: { componentSubtitle: 'A prop' } };
      `)
    ).toBeNull();
  });

  it('reports ambiguous parameters objects', () => {
    expect(() =>
      transformStorySource(`
        export default { parameters: {
          ...parameters,
          componentSubtitle: 'Legacy'
        } };
      `)
    ).toThrow();
  });
});
