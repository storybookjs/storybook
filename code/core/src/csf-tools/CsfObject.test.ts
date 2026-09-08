import { describe, expect, it } from 'vitest';

import { loadCsf, printCsf } from './CsfFile.ts';

const parse = (source: string) =>
  loadCsf(source, { makeTitle: (title) => title ?? 'title' }).parse();

describe('CsfObject', () => {
  it('moves a nested meta field and preserves its comments', () => {
    const csf = parse(`
      export default {
        parameters: {
          // Keep this explanation with the subtitle.
          componentSubtitle: 'Buttons',
        },
      };
    `);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(
      meta.move(['parameters', 'componentSubtitle'], ['parameters', 'docs', 'subtitle'])
    ).toEqual({ ok: true, changed: true });
    expect(csf.changed).toBe(true);
    expect(printCsf(csf).code).toMatch(
      /docs: \{\s+\/\/ Keep this explanation with the subtitle\.\s+subtitle: 'Buttons'/
    );
  });

  it('discovers an identifier-backed aliased story once', () => {
    const csf = parse(`
      export default { title: 'Example' };
      const Local = { parameters: { componentSubtitle: 'Aliased' } } satisfies Story;
      export { Local as First, Local as Second };
    `);

    const stories = csf.objects({ meta: false, stories: true });

    expect(stories).toHaveLength(1);
    expect(stories[0].target).toEqual({ kind: 'story', exportName: 'First', localName: 'Local' });
    expect(stories[0].get(['parameters', 'componentSubtitle'])).toMatchObject({
      type: 'StringLiteral',
      value: 'Aliased',
    });
  });

  it('uses logical paths for CSF2 parameter assignments', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters = { a11y: { element: '#root' } };
    `);
    const [parameters] = csf.objects({
      meta: false,
      stories: false,
      annotations: ['parameters'],
    });

    expect(parameters.rename(['parameters', 'a11y', 'element'], 'context')).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toContain(`Basic.parameters = { a11y: { context: '#root' } };`);
  });

  it('rejects repeated CSF2 annotations instead of exposing either object', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters = { first: true };
      Basic.parameters = { second: true };
    `);

    expect(csf.objects({ meta: false, stories: false, annotations: ['parameters'] })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'ambiguous-binding',
        target: expect.objectContaining({ kind: 'story-annotation', exportName: 'Basic' }),
      })
    );
  });

  it.each([
    ['spread-field', `{ ...base, componentSubtitle: 'Unsafe' }`],
    ['dynamic-key', `{ [field]: 'Unsafe', componentSubtitle: 'Unsafe' }`],
    ['duplicate-field', `{ componentSubtitle: 'One', componentSubtitle: 'Two' }`],
    ['unsupported-member', `{ get componentSubtitle() { return 'Unsafe' } }`],
  ])('rejects %s without changing the source', (code, parameters) => {
    const source = `export default { parameters: ${parameters} };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.remove(['parameters', 'componentSubtitle'])).toMatchObject({
      ok: false,
      changed: false,
      diagnostic: { code },
    });
    expect(csf.changed).toBe(false);
    expect(printCsf(csf).code).toBe(source);
  });

  it('rejects an occupied move destination without changing the source', () => {
    const source = `export default { parameters: { componentSubtitle: 'Old', docs: { subtitle: 'New' } } };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(
      meta.move(['parameters', 'componentSubtitle'], ['parameters', 'docs', 'subtitle'])
    ).toMatchObject({ ok: false, diagnostic: { code: 'occupied-destination' } });
    expect(printCsf(csf).code).toBe(source);
  });

  it('reports unsupported CSF factory candidates', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      export const Basic = meta.story({ args: {} });
    `);

    expect(csf.objects()).toEqual([]);
    expect(csf.mutationDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unsupported-initializer', target: { kind: 'meta' } }),
        expect.objectContaining({
          code: 'unsupported-initializer',
          target: expect.objectContaining({ kind: 'story', exportName: 'Basic' }),
        }),
      ])
    );
  });
});
