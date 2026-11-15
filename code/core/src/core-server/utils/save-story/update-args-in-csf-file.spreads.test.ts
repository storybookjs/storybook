import { runInNewContext } from 'node:vm';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { loadCsf, printCsf, textOf } from 'storybook/internal/csf-tools';

import { transformSync } from 'esbuild';
import { format } from 'prettier';

import { updateArgsInCsfFile } from './update-args-in-csf-file.ts';
import { SaveStoryError } from './utils.ts';

const makeTitle = (userTitle: string) => userTitle;

describe.each([
  ['CSF3', (object: string) => object],
  ['CSF3 satisfies', (object: string) => `${object} satisfies Story`],
  ['CSF4', (object: string) => `meta.story(${object})`],
] as const)('%s spread args', (variant, story) => {
  const makeBase = vi.fn();

  beforeEach(() => {
    makeBase.mockReturnValue({ args: { label: 'base' } });
  });

  const parseStory = (source: string, declarations = '') =>
    loadCsf(
      `${
        variant === 'CSF4'
          ? `import preview from '#.storybook/preview'; const meta = preview.meta({ title: 'Button' });`
          : `export default { title: 'Button' };`
      }
     ${declarations}
     export const Saved = ${source};`,
      { makeTitle }
    ).parse();

  test.each(['args', '"args"', '["args"]'])('updates %s without duplicating fields', (key) => {
    const csf = parseStory(story(`{ ${key}: { "label": "old", size: "small" } }`));
    const expected = parseStory(story(`{ ${key}: { "label": "saved", size: "small" } }`));

    updateArgsInCsfFile(csf, 'Saved', { label: 'saved' });

    expect(printCsf(csf).code).toBe(printCsf(expected).code);
  });

  test('preserves computed identifier keys', () => {
    const csf = parseStory(story('{ [args]: { label: "nested" }, args: { [label]: "keep" } }'));

    updateArgsInCsfFile(csf, 'Saved', { label: 'saved' });

    const { code } = transformSync(`(${textOf(csf.getStoryExport('Saved'))})`, { loader: 'ts' });
    const result = runInNewContext(code, {
      args: 'parameters',
      label: 'other',
      meta: { story: (input: unknown) => input },
    });
    expect(result.parameters).toEqual({ label: 'nested' });
    expect(result.args).toEqual({ other: 'keep', label: 'saved' });
  });

  test.each([
    '...makeBase()',
    'args: { label: "old" }, ...makeBase()',
    '...(makeBase() as Story)',
    '...makeBase?.()',
    '...makeBase().input',
    'args: { label: "old" }, ...makeBase().input',
    '...(makeBase().input as Story)',
    '...makeBase?.().input',
    '...Base[makeKey()]',
    '...(useFactory ? makeBase() : Base)',
    '...{ [makeKey()]() {} }',
    '...{ get args() { return makeBase().args; } }',
    '...new Factory()',
    '...tag`base`',
    '...(Base = Override)',
    '...(index++, Base)',
    '...(await Base)',
    '...Base[key]',
    '...{ args: { value: new Factory() } }',
    '...{ args: { values: [makeBase()] } }',
    '...{ args: { value: `${makeBase()}` } }',
    'args: { a: 1 }, ...{ __proto__: Base }',
    '..."abc"',
    '...(() => {})',
    '...{ ...Base }',
    '...Unknown, ...AnotherUnknown',
  ])('rejects saving through an unsafe spread: %s', (properties) => {
    const csf = parseStory(story(`{ ${properties} }`));
    const before = printCsf(csf).code;

    expect(() => updateArgsInCsfFile(csf, 'Saved', { label: 'saved' })).toThrow(SaveStoryError);

    expect(printCsf(csf).code).toBe(before);
    expect(csf.changed).toBe(false);
  });

  test('explains why an unsafe spread prevents saving', () => {
    const csf = parseStory(story('{ ...makeBase().input }'));

    expect(() => updateArgsInCsfFile(csf, 'Saved', { label: 'saved' })).toThrow(
      'Cannot save arg "label" of story Saved because a spread in the story could override it.'
    );
  });

  test.each([
    'render: () => makeBase()',
    'render: function () { return makeBase(); }',
    'render() { return makeBase(); }',
    '["render"]() { return makeBase(); }',
    'render: (value = makeBase()) => value',
  ])('preserves deferred calls in spread callbacks: %s', (render) => {
    const csf = parseStory(
      story(`{ ...Base }`),
      `const Base = { args: { size: "large" }, ${render} };`
    );

    updateArgsInCsfFile(csf, 'Saved', { label: 'saved' });

    const { code } = transformSync(`(${textOf(csf.getStoryExport('Saved'))})`, { loader: 'ts' });
    const Base = runInNewContext(`({ args: { size: "large" }, ${render} })`, { makeBase });
    const result = runInNewContext(code, { Base, meta: { story: (input: unknown) => input } });
    expect(result.args).toEqual({ size: 'large', label: 'saved' });
    expect(makeBase).not.toHaveBeenCalled();

    expect(result.render()).toEqual({ args: { label: 'base' } });
    expect(makeBase).toHaveBeenCalledOnce();
  });

  test.each(['', ', ...WithoutArgs'])(
    'does not repeat a call before local args: %s',
    (laterSpread) => {
      const csf = parseStory(story(`{ ...makeBase(), args: { label: "old" } ${laterSpread} }`));
      updateArgsInCsfFile(csf, 'Saved', { label: 'saved' });

      const { code } = transformSync(`(${textOf(csf.getStoryExport('Saved'))})`, { loader: 'ts' });
      const result = runInNewContext(code, {
        makeBase,
        WithoutArgs: {},
        meta: { story: (input: unknown) => input },
      });
      expect(result.args).toEqual({ label: 'saved' });
      expect(makeBase).toHaveBeenCalledOnce();
    }
  );

  const onClick = () => {};
  const inheritedArgs = { size: 'small', onClick };

  test.each([
    [
      'uses only the last spread that provides args',
      '...Base, parameters: { layout: "centered" }, ...Override',
      inheritedArgs,
    ],
    ['inherits args from a single spread', '...Base', { size: 'large', baseOnly: true }],
    ['inherits args from a typed spread', '...(Base as Story)', { size: 'large', baseOnly: true }],
    ['preserves arrays in literal args', '...Options', { options: ['a', 'b'] }],
    [
      'preserves quoted args before a spread',
      '"args": { "size": "small" }, ...WithoutArgs',
      { size: 'small' },
    ],
    [
      'preserves prototype-named args before a spread',
      'args: { constructor: "keep", toString: "keep", valueOf: "keep", hasOwnProperty: "keep" }, ...WithoutArgs',
      {
        constructor: 'keep',
        toString: 'keep',
        valueOf: 'keep',
        hasOwnProperty: 'keep',
      },
    ],
    [
      'preserves prototype-named args without a spread',
      'args: { constructor: "keep", toString: "keep", valueOf: "keep", hasOwnProperty: "keep" }',
      { constructor: 'keep', toString: 'keep', valueOf: 'keep', hasOwnProperty: 'keep' },
    ],
    [
      'preserves args when the last spread has none',
      '...Base, ...WithoutArgs',
      { size: 'large', baseOnly: true },
    ],
    ['handles spreads without args', '...WithoutArgs', {}],
    ['handles undefined spreads', '...UndefinedBase', {}],
    ['handles null spreads', '...NullBase', {}],
    [
      'preserves existing args before an undefined spread',
      'args: { label: "old", size: "small" }, ...UndefinedBase',
      { size: 'small' },
    ],
    [
      'preserves existing args before a null spread',
      'args: { label: "old", size: "small" }, ...NullBase',
      { size: 'small' },
    ],
    [
      'inherits args alongside nullish spreads',
      '...UndefinedBase, ...Base, ...NullBase',
      { size: 'large', baseOnly: true },
    ],
    ['handles optional input spreads', '...UndefinedBase?.input', {}],
    ['drops earlier args when the last spread clears them', '...Base, ...Cleared', {}],
    [
      'preserves existing args when a later spread has none',
      'args: { size: "small" }, ...WithoutArgs',
      { size: 'small' },
    ],
    [
      'moves existing args past spreads',
      'args: { label: "old", size: "medium", disabled: true }, ...Base, ...Override',
      inheritedArgs,
    ],
    [
      'uses a later spread instead of intervening local args',
      '...Base, args: { label: "old", size: "medium", disabled: true }, ...Override',
      { size: 'small', onClick },
    ],
    [
      'keeps local args from inheriting an overwritten spread',
      '...Base, args: { label: "old" }, ...WithoutArgs',
      {},
    ],
    [
      'updates args already after spreads',
      '...Base, ...Override, args: { label: "old", disabled: true }',
      { disabled: true },
    ],
  ])('%s', async (_, properties, expectedArgs) => {
    const csf = parseStory(
      story(`{ ${properties}, name: 'Saved story' }`),
      `
      const Base = { args: { label: 'base', size: 'large', baseOnly: true } };
      const Override = { args: { label: 'override', size: 'small', onClick } };
      const Options = { args: { options: ['a', 'b'] } };
      const WithoutArgs = { parameters: { layout: 'centered' } };
      const UndefinedBase = undefined;
      const NullBase = null;
      const Cleared = { args: undefined };
    `
    );
    const context = {
      Base: { args: { label: 'base', size: 'large', baseOnly: true } },
      Override: { args: { label: 'override', size: 'small', onClick } },
      WithoutArgs: { parameters: { layout: 'centered' } },
      UndefinedBase: undefined,
      NullBase: null,
      Cleared: { args: undefined },
      Options: { args: { options: ['a', 'b'] } },
      meta: { story: (input: unknown) => input },
    };
    const newArgs = { label: 'saved' };

    updateArgsInCsfFile(csf, 'Saved', newArgs);

    const saved = loadCsf(printCsf(csf).code, { makeTitle }).parse();
    const expression = textOf(saved.getStoryExport('Saved'));
    const { code } = transformSync(`(${expression})`, { loader: 'ts' });
    const result = runInNewContext(code, context);

    expect(result.args).toEqual({ ...expectedArgs, ...newArgs });
    expect(result.name).toBe('Saved story');

    updateArgsInCsfFile(saved, 'Saved', newArgs);
    expect(await format(printCsf(saved).code, { parser: 'typescript' })).toBe(
      await format(printCsf(csf).code, { parser: 'typescript' })
    );

    updateArgsInCsfFile(saved, 'Saved', { label: 'saved again' });
    const updatedExpression = textOf(saved.getStoryExport('Saved'));
    const updatedCode = transformSync(`(${updatedExpression})`, { loader: 'ts' }).code;
    const updated = runInNewContext(updatedCode, context);
    expect(updated.args).toEqual({ ...expectedArgs, label: 'saved again' });
  });
});

test('prints composed args for a CSF3 story spread', async () => {
  const csf = loadCsf(
    `export default { title: 'Button' };
     export const Saved = { ...Base };`,
    { makeTitle }
  ).parse();

  updateArgsInCsfFile(csf, 'Saved', { label: 'saved' });

  expect(await format(printCsf(csf).code, { parser: 'typescript' })).toMatchInlineSnapshot(`
    "export default { title: "Button" };
    export const Saved = { ...Base, args: { ...Base.args, label: "saved" } };
    "
  `);
});

test('prints composed args for a CSF4 input spread', async () => {
  const csf = loadCsf(
    `import preview from '#.storybook/preview';
     const meta = preview.meta({ title: 'Button' });
     export const Saved = meta.story({ ...Base.input });`,
    { makeTitle }
  ).parse();

  updateArgsInCsfFile(csf, 'Saved', { label: 'saved' });

  expect(await format(printCsf(csf).code, { parser: 'typescript' })).toMatchInlineSnapshot(`
    "import preview from "#.storybook/preview";
    const meta = preview.meta({ title: "Button" });
    export const Saved = meta.story({
      ...Base.input,
      args: { ...Base.input.args, label: "saved" },
    });
    "
  `);
  const expression = textOf(csf.getStoryExport('Saved'));
  const result = runInNewContext(`(${expression})`, {
    Base: { input: { args: { label: 'base', size: 'large' } } },
    meta: { story: (input: unknown) => input },
  });
  expect(result.args).toEqual({ label: 'saved', size: 'large' });
});

describe('story expressions', () => {
  const parseStory = (source: string) =>
    loadCsf(
      `import preview from '#.storybook/preview';
       const meta = preview.meta({ title: 'Button' });
       export const Base = meta.story({ args: { size: 'large' } });
       export const Saved = ${source};`,
      { makeTitle }
    ).parse();

  test.each([
    'meta.story({ args: { label: "old" }, ...Base.input }) as Story',
    'meta.story({ args: { label: "old" }, ...Base.input } satisfies Story)',
    'Base.extend({ args: { label: "old" }, ...Base.input })',
  ])('updates the story object in %s', (source) => {
    const csf = parseStory(source);

    updateArgsInCsfFile(csf, 'Saved', { label: 'saved' });

    const { code } = transformSync(`(${textOf(csf.getStoryExport('Saved'))})`, { loader: 'ts' });
    const result = runInNewContext(code, {
      meta: { story: (input: unknown) => input },
      Base: { input: { args: { size: 'large' } }, extend: (input: unknown) => input },
    });
    expect(result.args).toEqual({ size: 'large', label: 'saved' });
  });

  test.each([
    'meta.story(withDefaults({ args: { label: "old" } }))',
    'meta.story(storyArgs)',
    'meta.story(...[{ args: { label: "old" } }])',
    'meta.story({ args: { label: "old" }, [key]: {}, ...Base.input })',
    'meta.story({ [key]: {}, ...Base.input })',
    'meta.story({ args: { label: "old" }, args: {}, ...Base.input })',
  ])('refuses unsupported story inputs without changing source: %s', (source) => {
    const csf = parseStory(source);
    const before = printCsf(csf).code;

    expect(() => updateArgsInCsfFile(csf, 'Saved', { label: 'saved' })).toThrow(SaveStoryError);

    expect(printCsf(csf).code).toBe(before);
    expect(csf.changed).toBe(false);
  });

  test('updates only top-level CSF4 args', () => {
    const csf = parseStory(`meta.story({
      args: { label: 'old', options: { label: 'nested' } },
      parameters: { args: { label: 'parameter' } },
    })`);

    updateArgsInCsfFile(csf, 'Saved', { label: 'saved' });

    const result = runInNewContext(`(${textOf(csf.getStoryExport('Saved'))})`, {
      meta: { story: (input: unknown) => input },
    });
    expect(result).toEqual({
      args: { label: 'saved', options: { label: 'nested' } },
      parameters: { args: { label: 'parameter' } },
    });
  });

  test('rolls back composed args when a later arg cannot be saved', () => {
    const csf = parseStory('meta.story({ args: { label: "old" }, ...Base.input })');
    const before = printCsf(csf).code;

    expect(() =>
      updateArgsInCsfFile(csf, 'Saved', {
        label: 'saved',
        ['__proto__']: 'invalid',
      })
    ).toThrow(SaveStoryError);

    expect(printCsf(csf).code).toBe(before);
    expect(csf.changed).toBe(false);
  });

  test('preserves comments when moving args after a spread', async () => {
    const csf = parseStory(`meta.story({
      // Local defaults
      args: {
        label: 'old',
        // Keep this option
        disabled: true,
      },
      ...Base.input,
    })`);

    updateArgsInCsfFile(csf, 'Saved', { label: 'saved' });

    expect(await format(textOf(csf.getStoryExport('Saved')), { parser: 'typescript' }))
      .toMatchInlineSnapshot(`
        "meta.story({
          ...Base.input,
          // Local defaults
          args: {
            ...{
              args: {
                label: "old",
                // Keep this option
                disabled: true,
              },
              ...Base.input,
            }.args,
            label: "saved",
          },
        });
        "
      `);
  });
});
