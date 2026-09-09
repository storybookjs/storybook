import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

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

  it('does not expose mutable AST nodes through get or set', () => {
    const csf = parse(`export default { title: 'Original' };`);
    const [meta] = csf.objects({ meta: true, stories: false });
    const value = meta.get(['title']);
    const replacement = t.stringLiteral('Replacement');

    if (t.isStringLiteral(value)) {
      value.value = 'Mutated';
    }
    expect(meta.set(['title'], replacement)).toEqual({ ok: true, changed: true });
    replacement.value = 'Mutated replacement';

    expect(printCsf(csf).code).toContain('title: "Replacement"');
    expect(printCsf(csf).code).not.toContain('Mutated');
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

  it('rejects moving a field below itself without changing the source', () => {
    const source = `export default { parameters: { docs: { source: true } } };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.move(['parameters', 'docs'], ['parameters', 'docs', 'subtitle'])).toMatchObject({
      ok: false,
      diagnostic: { code: 'cyclic-move' },
    });
    expect(csf.changed).toBe(false);
    expect(printCsf(csf).code).toBe(source);
  });

  it('treats a move to the same path as a no-op', () => {
    const source = `export default { title: 'Example' };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.rename(['title'], 'title')).toEqual({ ok: true, changed: false });
    expect(csf.changed).toBe(false);
    expect(printCsf(csf).code).toBe(source);
  });

  it('rejects prototype-setting destination paths', () => {
    const source = `export default { title: 'Example' };`;
    const csf = parse(source);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.set(['parameters', '__proto__', 'polluted'], t.booleanLiteral(true))).toMatchObject(
      {
        ok: false,
        diagnostic: { code: 'unsupported-member' },
      }
    );
    expect(printCsf(csf).code).toBe(source);
  });

  it('addresses numeric literal keys by their static string value', () => {
    const csf = parse(`export default { parameters: { 1: 'one' } };`);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(meta.remove(['parameters', '1'])).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).not.toContain(`1: 'one'`);
  });

  it('rejects reassigned direct exports', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export let Basic = { args: { label: 'First' } };
      Basic = { args: { label: 'Second' } };
    `);

    expect(csf.objects({ meta: false, stories: true })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'ambiguous-binding',
        target: { kind: 'story', exportName: 'Basic', localName: 'Basic' },
      })
    );
  });

  it('reports re-exported story candidates', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export { Basic } from './Basic.stories';
    `);

    expect(csf.objects({ meta: false, stories: true })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-initializer',
        target: { kind: 'story', exportName: 'Basic', localName: 'Basic' },
      })
    );
  });

  it('selects a retained alias when another alias is excluded', () => {
    const csf = parse(`
      export default { title: 'Example', includeStories: ['Second'] };
      const Local = { args: {} };
      export { Local as First, Local as Second };
    `);
    const [story] = csf.objects({ meta: false, stories: true });

    expect(story.target).toEqual({ kind: 'story', exportName: 'Second', localName: 'Local' });
  });

  it('rejects a reassigned identifier-backed meta object', () => {
    const csf = parse(`
      let meta = { title: 'First' };
      meta = { title: 'Second' };
      export default meta;
    `);

    expect(csf.objects({ meta: true, stories: false })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'ambiguous-binding', target: { kind: 'meta' } })
    );
  });

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

  it('reports compound CSF2 annotation assignments', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters ||= { a11y: true };
    `);

    expect(csf.objects({ meta: false, stories: false, annotations: ['parameters'] })).toHaveLength(
      0
    );
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
    expect(csf.mutationDiagnostics).not.toBe(csf.mutationDiagnostics);
  });

  it('mutates CSF4 meta objects', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ parameters: { componentSubtitle: 'Buttons' } });
      export const Basic = meta.story({});
    `);
    const [meta] = csf.objects({ meta: true, stories: false });

    expect(
      meta.move(['parameters', 'componentSubtitle'], ['parameters', 'docs', 'subtitle'])
    ).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toMatch(
      /preview\.meta\(\{ parameters: \{ docs: \{\s+subtitle: 'Buttons'/
    );
  });

  it('renames fields in CSF4 story objects', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      export const Basic = meta.story({ parameters: {
        // Keep the configuration note.
        a11y: true,
      } });
    `);
    const [basic] = csf.objects({ meta: false, stories: true });

    expect(basic.rename(['parameters', 'a11y'], 'accessibility')).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toMatch(/Keep the configuration note\.\s+accessibility: true/);
  });

  it('removes fields from CSF4 extended story objects', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      const Base = meta.story({});
      export const Basic = Base.extend({ parameters: { a11y: true } });
    `);
    const [basic] = csf.objects({ meta: false, stories: true });

    expect(basic.remove(['parameters', 'a11y'])).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).not.toContain('a11y');
  });

  it.each([
    ['meta without an argument', `const meta = preview.meta();`],
    [
      'identifier-backed story argument',
      `const meta = preview.meta({});\nconst config = { args: {} };\nexport const Basic = meta.story(config);`,
    ],
    [
      'dynamic extend argument',
      `const meta = preview.meta({});\nconst Base = meta.story({});\nexport const Basic = Base.extend(makeConfig());`,
    ],
  ])('reports an unsupported CSF4 %s', (_kind, code) => {
    const csf = parse(`import preview from './preview';\n${code}`);

    csf.objects();

    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'unsupported-initializer' })
    );
  });

  it('reports an ambiguous CSF4 factory chain', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      export const Basic = getMeta().story({ args: {} });
    `);

    expect(csf.objects({ meta: false, stories: true })).toHaveLength(0);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unsupported-initializer',
        target: expect.objectContaining({ kind: 'story', exportName: 'Basic' }),
      })
    );
  });
});
