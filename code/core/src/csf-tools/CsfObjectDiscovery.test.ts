import { describe, expect, it } from 'vitest';

import { loadCsf, printCsf } from './CsfFile.ts';

const parse = (source: string) =>
  loadCsf(source, { makeTitle: (title) => title ?? 'title' }).parse();

describe('CsfObject discovery', () => {
  it('supports static bracket notation for CSF2 annotations', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic['parameters'] = { a11y: true };
    `);
    const [parameters] = csf.objects({
      meta: false,
      stories: false,
      annotations: ['parameters'],
    });

    expect(parameters.remove(['parameters', 'a11y'])).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).not.toContain('a11y');
  });

  it('reports computed CSF2 annotations with a nonliteral name', () => {
    const csf = parse(`
      const key = getKey();
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic[key] = { a11y: true };
    `);

    expect(csf.objects({ meta: false, stories: false, annotations: ['parameters'] })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-initializer',
        target: {
          kind: 'story-annotation',
          exportName: 'Basic',
          localName: 'Basic',
          annotation: 'parameters',
        },
      })
    );
  });

  it('rejects every requested annotation after a computed CSF2 write', () => {
    const csf = parse(`
      const key = getKey();
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.story = { name: 'Basic' };
      Basic[key] = { a11y: true };
    `);

    expect(
      csf.objects({ meta: false, stories: false, annotations: ['parameters', 'story'] })
    ).toEqual([]);
    expect(csf.mutationDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported-initializer',
          target: expect.objectContaining({ annotation: 'parameters' }),
        }),
        expect.objectContaining({
          code: 'ambiguous-binding',
          target: expect.objectContaining({ annotation: 'story' }),
        }),
      ])
    );
  });

  it('does not discover excluded CSF4 factory exports', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example', includeStories: ['Basic'] });
      export const Helper = meta.story({ parameters: { viewport: { defaultViewport: 'mobile' } } });
      export const Basic = meta.story({});
    `);

    expect(csf.objects({ meta: false, stories: true })).toHaveLength(1);
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('does not diagnose excluded direct exports or re-exports', () => {
    const direct = parse(`
      export default { title: 'Example', includeStories: ['Basic'] };
      export let Helper = { args: {} };
      Helper = { args: { changed: true } };
      export const Basic = { args: {} };
    `);
    const reExport = parse(`
      export default { title: 'Example', includeStories: ['Basic'] };
      export { Helper } from './helper';
      export const Basic = { args: {} };
    `);

    direct.objects({ meta: false, stories: true });
    reExport.objects({ meta: false, stories: true });

    expect(direct.mutationDiagnostics).toEqual([]);
    expect(reExport.mutationDiagnostics).toEqual([]);
  });

  it('reports compound CSF2 annotation assignments', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters ||= { a11y: true };
    `);

    expect(csf.objects({ meta: false, stories: false, annotations: ['parameters'] })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'unsupported-initializer' })
    );
  });

  it('does not discover or diagnose stories when only meta is requested', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export let Basic = { args: {} };
      Basic = { args: { changed: true } };
    `);

    expect(csf.objects({ meta: true, stories: false })).toHaveLength(1);
    expect(csf.mutationDiagnostics).toEqual([]);
  });

  it('discovers an identifier-backed factory meta configuration', () => {
    const csf = parse(`
      import preview from './preview';
      const config = { title: 'Example' };
      const meta = preview.meta(config);
      export const Basic = meta.story({});
    `);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.get(['title'])).toMatchObject({ type: 'StringLiteral', value: 'Example' });
  });

  it.each([
    [
      'a reassigned binding',
      `
        let config = { title: 'Example' };
        config = { title: 'Changed' };
      `,
    ],
    [
      'a member-mutated binding',
      `
        const config = { title: 'Example', parameters: { componentSubtitle: 'old' } };
        config.parameters = { componentSubtitle: 'new' };
      `,
    ],
    [
      'an aliased binding',
      `
        const config = { title: 'Example' };
        const alias = config;
        alias.title = 'Changed';
      `,
    ],
    [
      'an Object.assign call',
      `
        const config = { title: 'Example' };
        Object.assign(config, { title: 'Changed' });
      `,
    ],
    ['a non-const binding', `let config = { title: 'Example' }`],
    ['a non-object binding', `const config = []`],
    ['an unresolved binding', ''],
  ])('rejects identifier-backed factory meta configuration with %s', (_kind, config) => {
    const csf = parse(`
      import preview from './preview';
      ${config}
      const meta = preview.meta(config);
      export const Basic = meta.story({});
    `);

    expect(csf.objects({ meta: true, stories: false })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'unsupported-initializer', target: { kind: 'meta' } })
    );
  });

  it('rejects direct factory receivers that were reassigned', () => {
    const csf = parse(`
      import preview from './preview';
      let meta = preview.meta({ title: 'Example' });
      meta = helper;
      export const Basic = meta.story({ parameters: { a11y: true } });
    `);

    expect(csf.objects({ meta: false, stories: true })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-initializer',
        target: { kind: 'story', exportName: 'Basic', localName: 'Basic' },
      })
    );
  });
});
