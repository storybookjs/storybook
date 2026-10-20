import { describe, expect, it } from 'vitest';

import { loadCsf, printCsf } from './CsfFile.ts';
import { parseExpression } from './estree/ast.ts';

const parse = (source: string) =>
  loadCsf(source, { makeTitle: (title) => title ?? 'title' }).parse();

describe('CsfObject discovery', () => {
  it('supports static bracket notation for CSF2 annotations', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic['parameters'] = { a11y: true };
    `);
    const [parameters] = csf.objects({ meta: false });

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

    expect(csf.objects({ meta: false })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'dynamic-key',
        target: { kind: 'story', exportName: 'Basic', localName: 'Basic' },
      })
    );
  });

  it('rejects an annotation that is also written under a computed key', () => {
    const csf = parse(`
      const key = getKey();
      export default { title: 'Example' };
      export const Basic = () => null;
      Basic.parameters = { a11y: true };
      Basic[key] = { a11y: false };
    `);

    expect(csf.objects({ meta: false })).toEqual([]);
    expect(csf.mutationDiagnostics).toEqual([
      expect.objectContaining({
        code: 'dynamic-key',
        target: { kind: 'story', exportName: 'Basic', localName: 'Basic' },
      }),
    ]);
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

  it('discovers CSF4 factory stories typed with meta.type<>()', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' });
      export const Basic = meta.type<{ args: { icon: string } }>().story({
        parameters: { a11y: true },
      });
    `);
    const [story] = csf.objects({ meta: false, stories: true });

    expect(story.remove(['parameters', 'a11y'])).toEqual({ ok: true, changed: true });
    expect(csf.mutationDiagnostics).toEqual([]);
    expect(printCsf(csf).code).not.toContain('a11y');
  });

  it('discovers CSF4 factory stories of a typed meta held in a constant', () => {
    const csf = parse(`
      import preview from './preview';
      const meta = preview.meta({ title: 'Example' }).type<{ args: { size: number } }>();
      const withIcon = meta.type<{ args: { icon: string } }>();
      export const Basic = meta.story({ parameters: { a11y: true } });
      export const WithIcon = withIcon.story({ parameters: { a11y: true } });
    `);

    expect(csf.objects({ meta: false, stories: true })).toHaveLength(2);
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

    expect(csf.objects({ meta: false })).toEqual([]);
    expect(csf.mutationDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'unsupported-initializer' })
    );
  });

  it('does not discover or diagnose stories or their annotations when only meta is requested', () => {
    const csf = parse(`
      export default { title: 'Example' };
      export let Basic = { args: {} };
      Basic = { args: { changed: true } };
      export const Legacy = () => null;
      Legacy.parameters = { a11y: true };
      Legacy.parameters = { a11y: false };
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

    expect(meta.get(['title'])).toMatchObject({ type: 'Literal', value: 'Example' });
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

  describe('CSF2 annotation assignments', () => {
    const legacy = `export default { title: 'Example' };
const Template = (args) => args;
export const Primary = Template.bind({});
Primary.args = { label: 'Primary' };
Primary.argTypes = { label: { control: 'text' } };
Primary.parameters = { msw: { handlers: [] } };
Primary.decorators = [withTheme];
Primary.loaders = [async () => ({})];
Primary.beforeEach = setup;
Primary.play = async () => {};
Primary.render = (args) => args;
Primary.tags = ['autodocs'];
`;

    it('edits every annotation of a story through one editor with the paths of a story object', () => {
      const csf = parse(legacy);
      const objects = csf.objects({ meta: false });

      expect(objects.map(({ target }) => target)).toEqual([
        { kind: 'story', exportName: 'Primary', localName: 'Primary' },
      ]);
      const [story] = objects;
      expect(story.getValue(['args'])).toEqual({ label: 'Primary' });
      expect(story.getValue(['argTypes', 'label', 'control'])).toBe('text');
      expect(story.getValue(['tags'])).toEqual(['autodocs']);
      for (const annotation of ['decorators', 'loaders', 'beforeEach', 'play', 'render']) {
        expect(story.get([annotation])).toBeDefined();
      }

      expect(story.set(['args', 'label'], 'Changed').ok).toBe(true);
      expect(story.set(['play'], parseExpression('async () => run()')).ok).toBe(true);
      expect(story.remove(['tags']).ok).toBe(true);
      expect(printCsf(csf).code).toContain("Primary.args = { label: 'Changed' };");
      expect(printCsf(csf).code).toContain('Primary.play = async () => run();');
      expect(printCsf(csf).code).not.toContain('Primary.tags');
      expect(csf.mutationDiagnostics).toEqual([]);
    });

    it('adds a missing annotation after the last one and removes an annotation that is emptied', () => {
      const csf = parse(
        legacy.replace(/^Primary\.(decorators|loaders|beforeEach|play|render|tags) = .*\n/gm, '')
      );
      const [story] = csf.objects({ meta: false });

      const kept = csf.transaction(() => {
        story.remove(['parameters', 'msw']);
        story.set(['beforeEach'], parseExpression('mockHandlers'));
      });

      expect(kept).toBe(true);
      expect(printCsf(csf).code).toBe(`export default { title: 'Example' };
const Template = (args) => args;
export const Primary = Template.bind({});
Primary.args = { label: 'Primary' };
Primary.argTypes = { label: { control: 'text' } };
Primary.beforeEach = mockHandlers;
`);
    });

    it('writes an annotation without a semicolon in a file without semicolons', () => {
      const csf = parse(`export default { title: 'Example' }
const Template = (args) => args
export const Primary = Template.bind({})
Primary.args = { label: 'Primary' }
const after = 1
`);
      const [story] = csf.objects({ meta: false });

      expect(story.set(['beforeEach'], parseExpression('mockHandlers'))).toEqual({
        ok: true,
        changed: true,
      });
      expect(printCsf(csf).code).toBe(`export default { title: 'Example' }
const Template = (args) => args
export const Primary = Template.bind({})
Primary.args = { label: 'Primary' }
Primary.beforeEach = mockHandlers
const after = 1
`);
    });

    it('writes an annotation named by a reserved word as a member access', () => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = () => null;
`);
      const [story] = csf.objects({ meta: false });

      expect(story.set(['default'], true)).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code).toBe(`export default { title: 'Example' };
export const Primary = () => null;
Primary.default = true;
`);
    });

    it('ends an annotation with a semicolon before a statement that would continue it', () => {
      const csf = parse(`export default { title: 'Example' }
export function Primary() {}
[1].forEach(f)
`);
      const [story] = csf.objects({ meta: false });

      expect(story.set(['args', 'a'], 1)).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code).toBe(`export default { title: 'Example' }
export function Primary() {}
Primary.args = { a: 1 };
[1].forEach(f)
`);
    });

    it('adds the first annotation of a story after its declaration', () => {
      const csf = parse(`export default { title: 'Example' };
const Local = () => null;
export { Local as Primary };
const after = 1;
`);
      const [story] = csf.objects({ meta: false });

      expect(story.set(['parameters', 'layout'], 'centered')).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code).toBe(`export default { title: 'Example' };
const Local = () => null;
Local.parameters = { layout: 'centered' };
export { Local as Primary };
const after = 1;
`);
    });

    it('adds an annotation to a story declared as a function', () => {
      const csf = parse(`export default { title: 'Example' };
export function Primary() {}
`);
      const [story] = csf.objects({ meta: false });

      expect(story.set(['args'], { label: 'Primary' })).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code).toBe(`export default { title: 'Example' };
export function Primary() {}
Primary.args = { label: 'Primary' };
`);
    });

    it.each([
      ['an arrow function', 'export const Primary = () => null;'],
      [
        'a bound template',
        'const Template = () => null;\nexport const Primary = Template.bind({});',
      ],
    ])(
      'refuses to give a story declared as %s an own function property that cannot be assigned',
      (_case, story) => {
        const source = `export default { title: 'Example' };\n${story}\nPrimary.storyName = 'Old';\n`;
        const csf = parse(source);
        const [primary] = csf.objects({ meta: false });
        const refusal = (key: string, path = [key]) => ({
          ok: false,
          changed: false,
          diagnostic: {
            code: 'unsupported-member',
            path,
            message: expect.stringContaining(
              `Cannot add Primary.${key} because a function's ${key} cannot be assigned`
            ),
          },
        });

        for (const key of ['name', 'length', 'caller', 'arguments']) {
          expect(primary.set([key], 'Pretty')).toMatchObject(refusal(key));
          expect(primary.set([key, 'nested'], 'Pretty')).toMatchObject(
            refusal(key, [key, 'nested'])
          );
          expect(primary.rename(['storyName'], key)).toMatchObject(refusal(key));
          expect(primary.move(['storyName'], [key])).toMatchObject(refusal(key));
          expect(primary.group([key], ['storyName'])).toMatchObject(refusal(key));
        }
        expect(primary.set(['name'], 'Pretty')).toMatchObject({
          diagnostic: { message: expect.stringContaining('; set storyName instead') },
        });
        expect(printCsf(csf).code).toBe(source);

        expect(primary.set(['storyName'], 'Pretty')).toEqual({ ok: true, changed: true });
        expect(printCsf(csf).code).toBe(source.replace(`'Old'`, `'Pretty'`));
      }
    );

    it('sets name and length in a story object', () => {
      const csf = parse(
        `export default { title: 'Example' };\nexport const Primary = { args: {} };\n`
      );
      const [story] = csf.objects({ meta: false });

      expect(story.set(['name'], 'Pretty')).toEqual({ ok: true, changed: true });
      expect(story.set(['length'], 2)).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code).toBe(
        `export default { title: 'Example' };\nexport const Primary = { args: {}, name: 'Pretty', length: 2 };\n`
      );
    });

    it('edits the object of a story and its assignments as one object', () => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = { args: { label: 'Primary' } };
Primary.parameters = { layout: 'centered' };
`);
      const objects = csf.objects({ meta: false });
      expect(objects).toHaveLength(1);
      const [story] = objects;

      expect(story.set(['tags'], ['autodocs']).ok).toBe(true);
      expect(story.remove(['parameters', 'layout']).ok).toBe(true);
      expect(printCsf(csf).code).toBe(`export default { title: 'Example' };
export const Primary = { args: { label: 'Primary' }, tags: ['autodocs'] };
`);
    });

    it('rejects an annotation written both in the story object and as an assignment', () => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = { args: { label: 'Primary' } };
Primary.args = { label: 'Assigned' };
`);
      const [story] = csf.objects({ meta: false });

      expect(story.set(['args', 'label'], 'Changed').ok).toBe(false);
      expect(story.getValue(['args'])).toBeUndefined();
      expect(csf.mutationDiagnostics.map(({ code }) => code)).toEqual([
        'duplicate-field',
        'duplicate-field',
      ]);
    });

    it.each([
      ['an alias', 'export const Secondary = Primary;\nSecondary.args = {};'],
      ['a nested write', "Primary.args.label = 'Changed';"],
      ['an Object.assign call', 'Object.assign(Primary, { args: {} });'],
    ])('rejects a story whose binding has %s', (_kind, code) => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = () => null;
Primary.args = { label: 'Primary' };
${code}
`);

      expect(
        csf
          .objects({ meta: false })
          .filter(({ target }) => 'exportName' in target && target.exportName === 'Primary')
      ).toEqual([]);
      expect(csf.mutationDiagnostics).toContainEqual(
        expect.objectContaining({
          code: 'ambiguous-binding',
          target: { kind: 'story', exportName: 'Primary', localName: 'Primary' },
        })
      );
    });

    it('groups assignments into a new assignment and refuses to group them with object fields', () => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = () => null;
Primary.width = 1;
Primary.height = 2;
export const Mixed = { width: 1 };
Mixed.height = 2;
`);
      const [primary, mixed] = csf.objects({ meta: false });

      expect(primary.group(['size'], ['width', 'height'])).toEqual({ ok: true, changed: true });
      expect(mixed.group(['size'], ['width', 'height'])).toMatchObject({
        ok: false,
        diagnostic: { code: 'evaluation-order' },
      });
      expect(printCsf(csf).code).toBe(`export default { title: 'Example' };
export const Primary = () => null;
Primary.size = { width: 1, height: 2 };
export const Mixed = { width: 1 };
Mixed.height = 2;
`);
    });

    it('edits a story that another story calls', () => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = (args) => null;
export const Secondary = (args) => Primary(args);
`);

      expect(csf.objects({ meta: false })).toHaveLength(2);
      expect(csf.mutationDiagnostics).toEqual([]);
    });

    it.each([
      ['a story without annotations in an array', 'export const all = [Primary];'],
      ['a spread of the story', 'export const Copy = { ...Primary };'],
    ])('rejects %s, which could see the annotations it adds', (_kind, code) => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = Template.bind({});
${code}
`);

      expect(
        csf
          .objects({ meta: false })
          .filter(({ target }) => 'exportName' in target && target.exportName === 'Primary')
      ).toEqual([]);
      expect(csf.mutationDiagnostics).toContainEqual(
        expect.objectContaining({
          code: 'ambiguous-binding',
          target: { kind: 'story', exportName: 'Primary', localName: 'Primary' },
        })
      );
    });

    it('rejects a story object with a nested write, which its fields would not show', () => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = { args: { label: 'Primary' } };
Primary.args.label = 'Changed';
`);

      expect(csf.objects({ meta: false })).toEqual([]);
      expect(csf.mutationDiagnostics).toEqual([
        expect.objectContaining({ code: 'ambiguous-binding', path: [] }),
      ]);
    });

    it('renames an annotation of a parenthesized story', () => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = () => null;
(Primary).argTypes = { label: { control: 'text' } };
`);
      const [story] = csf.objects({ meta: false });

      expect(story.rename(['argTypes'], 'args')).toEqual({ ok: true, changed: true });
      expect(printCsf(csf).code).toBe(`export default { title: 'Example' };
export const Primary = () => null;
(Primary).args = { label: { control: 'text' } };
`);
    });

    it('does not add annotations to a story that holds another value', () => {
      const csf = parse(`export default { title: 'Example' };
export const Primary = shared;
Primary.args = {};
`);

      expect(csf.objects({ meta: false })).toEqual([]);
      expect(csf.mutationDiagnostics).toContainEqual(
        expect.objectContaining({ code: 'unsupported-initializer', path: ['args'] })
      );
    });
  });
});
