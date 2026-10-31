import { runInNewContext } from 'node:vm';

import { describe, expect, test } from 'vitest';

import { loadConfig, loadCsf, printCsf, textOf } from './index.ts';

const options = { makeTitle: () => 'Example' };

describe('set with overrideSpreads', () => {
  test('keeps the default refusal and only overrides when requested', () => {
    const csf = loadCsf(
      `export default {}; const Base = { args: { inherited: true } };
      export const Story = { args: { obsolete: true }, ...Base };`,
      options
    ).parse();
    const [story] = csf.objects({ meta: false });
    const before = printCsf(csf).code;

    expect(story.set(['args', 'label'], 'saved')).toMatchObject({
      ok: false,
      diagnostic: { code: 'spread-field' },
    });
    expect(printCsf(csf).code).toBe(before);
    expect(story.set(['args', 'label'], 'saved', { overrideSpreads: true })).toEqual({
      ok: true,
      changed: true,
    });
    expect(textOf(csf.getStoryExport('Story'))).toMatchInlineSnapshot(
      `"{ ...Base, args: { ...Base.args, label: "saved" } }"`
    );
  });

  test('supports the same option on configuration objects', () => {
    const config = loadConfig(
      `const Base = { parameters: { inherited: true } }; export default { parameters: {}, ...Base };`
    ).parse();

    expect(config.set(['parameters', 'label'], 'saved', { overrideSpreads: true })).toEqual({
      ok: true,
      changed: true,
    });
    expect(config.getValue(['parameters', 'label'])).toBe('saved');
  });

  test.each(['{ args: { a: 1 }, ...Local }', '{ ...Local }'])(
    'preserves ordinary edits of %s',
    (object) => {
      const source = `export default {}; const Local = { name: 'local' }; export const Story = ${object};`;
      const normal = loadCsf(source, options).parse();
      const override = loadCsf(source, options).parse();

      normal.objects({ meta: false })[0].set(['args', 'label'], 'saved');
      override
        .objects({ meta: false })[0]
        .set(['args', 'label'], 'saved', { overrideSpreads: true });

      expect(printCsf(override).code).toBe(printCsf(normal).code);
    }
  );

  test.each([
    [{ args: { inherited: true } }, { inherited: true }],
    [{}, { local: true }],
    [{ args: undefined }, {}],
    [{ args: null }, {}],
    [Object.create({ args: { inherited: true } }), { local: true }],
    [null, { local: true }],
    [undefined, { local: true }],
  ])('preserves the effective parent from an external spread: %j', (Base, expected) => {
    const csf = loadCsf(
      `export default {}; export const Story = { args: { local: true }, ...Base };`,
      options
    ).parse();

    expect(
      csf.objects({ meta: false })[0].set(['args', 'label'], 'saved', { overrideSpreads: true }).ok
    ).toBe(true);

    const result = runInNewContext(`(${textOf(csf.getStoryExport('Story'))})`, { Base });
    expect(result.args).toEqual({ ...expected, label: 'saved' });
  });

  test('preserves nested fields when a later spread replaces their parent', () => {
    const csf = loadCsf(
      `export default {};
      const Base = { parameters: { docs: { inherited: true }, layout: 'centered' } };
      export const Story = { parameters: { docs: { obsolete: true } }, ...Base };`,
      options
    ).parse();

    expect(
      csf
        .objects({ meta: false })[0]
        .set(['parameters', 'docs', 'name'], 'saved', { overrideSpreads: true }).ok
    ).toBe(true);

    const result = runInNewContext(`(${textOf(csf.getStoryExport('Story'))})`, {
      Base: { parameters: { docs: { inherited: true }, layout: 'centered' } },
    });
    expect(result.parameters).toEqual({
      docs: { inherited: true, name: 'saved' },
      layout: 'centered',
    });
  });

  test.each([
    'args: { label: makeLabel() }, ...Base',
    'args: { label: "old" }, ...makeBase()',
    'args: { label: "old" }, ...Base, ...Other',
    'args: { label: "old" }, [key]: {}, ...Base',
    'args: {}, args: {}, ...Base',
    'args: {}, ...{ __proto__: Base }',
  ])('leaves a refused override untouched: %s', (members) => {
    const csf = loadCsf(`export default {}; export const Story = { ${members} };`, options).parse();
    const before = printCsf(csf).code;
    const [story] = csf.objects({ meta: false });

    expect(story.set(['args', 'label'], 'saved', { overrideSpreads: true }).ok).toBe(false);
    expect(printCsf(csf).code).toBe(before);
    expect(csf.changed).toBe(false);
    expect(story.changed).toBe(false);
  });

  test('rolls an override back with the surrounding transaction', () => {
    const csf = loadCsf(
      `export default {}; const Base = { args: { inherited: true } }; export const Story = { args: {}, ...Base };`,
      options
    ).parse();
    const before = printCsf(csf).code;
    const [story] = csf.objects({ meta: false });

    expect(
      csf.transaction(() => {
        story.set(['args', 'label'], 'saved', { overrideSpreads: true });
        return false;
      })
    ).toBe(false);
    expect(printCsf(csf).code).toBe(before);
    expect(csf.changed).toBe(false);
    expect(story.changed).toBe(false);
  });
});
