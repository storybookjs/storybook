import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { describe, expect, test, vi } from 'vitest';

import { generate, parser } from 'storybook/internal/babel';
import { loadCsf, printCsf, readCsf } from 'storybook/internal/csf-tools';

import { transformSync } from 'esbuild';
import { format } from 'prettier';

import { getDiff } from './getDiff.ts';
import { updateArgsInCsfFile } from './update-args-in-csf-file.ts';
import { SaveStoryError } from './utils.ts';

const makeTitle = (userTitle: string) => userTitle;

const FILES = {
  typescriptConstructs: join(__dirname, 'mocks/typescript-constructs.stories.tsx'),
  csfVariances: join(__dirname, 'mocks/csf-variances.stories.tsx'),
  csf4Variances: join(__dirname, 'mocks/csf4-variances.stories.tsx'),
  unsupportedCsfVariances: join(__dirname, 'mocks/unsupported-csf-variances.stories.tsx'),
  exportVariances: join(__dirname, 'mocks/export-variances.stories.tsx'),
  dataVariances: join(__dirname, 'mocks/data-variances.stories.tsx'),
};

describe('success', () => {
  test('Typescript Constructs', async () => {
    const newArgs = { bordered: true, initial: 'test1' };

    const before = await format(await readFile(FILES.typescriptConstructs, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.typescriptConstructs, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);
    const nodes = names.map((name) => CSF.getStoryExport(name));

    nodes.forEach((node) => {
      updateArgsInCsfFile(node, newArgs);
    });

    const after = await format(printCsf(parsed).code, {
      parser: 'typescript',
    });

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        
        export const Cast: Story = {
          args: {
        
      -     initial: "bar",
      - 
      +     initial: "test1",
      +     bordered: true,
      + 
          },
        };
        
        export const As = {
          args: {
        
      -     initial: "bar",
      - 
      +     initial: "test1",
      +     bordered: true,
      + 
          },
        } as Story;
        
        export const Satisfies = {
          args: {
        
      -     initial: "bar",
      - 
      +     initial: "test1",
      +     bordered: true,
      + 
          },
        } satisfies Story;
        
        export const None = {
          args: {
        
      -     initial: "bar",
      - 
      +     initial: "test1",
      +     bordered: true,
      + 
          },
        };
        "
    `);
  });
  test('Unsupported CSF Variances', async () => {
    const newArgs = { bordered: true, initial: 'test1' };

    const CSF = await readCsf(FILES.unsupportedCsfVariances, { makeTitle });
    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);
    const nodes = names.map((name) => CSF.getStoryExport(name));

    for (const node of nodes) {
      await expect(() => updateArgsInCsfFile(node, newArgs)).rejects.toThrowError();
    }
  });
  test('CSF Variances', async () => {
    const newArgs = { bordered: true, initial: 'test1' };

    const before = await format(await readFile(FILES.csfVariances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.csfVariances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);
    const nodes = names.map((name) => CSF.getStoryExport(name));

    nodes.forEach((node) => {
      updateArgsInCsfFile(node, newArgs);
    });

    const after = await format(printCsf(parsed).code, {
      parser: 'typescript',
    });

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    // TODO, the comment is not preserved!!!
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
          initial: string;
        }> = (props) => <pre>{JSON.stringify(props)}</pre>;
        
        
      - export const Empty = {} satisfies Story;
      - 
      + export const Empty = {
      +   args: {
      +     bordered: true,
      +     initial: "test1",
      +   },
      + } satisfies Story;
      + 
        
        export const EmptyWithComment = {
        
      -   // this is a useless comment, to test that it is preserved
      - 
      +   args: {
      +     bordered: true,
      +     initial: "test1",
      +   },
      + 
        } satisfies Story;
        
        export const OnlyArgs = {
          args: {
            absolute: true,
        
      +     bordered: true,
      +     initial: "test1",
      + 
          },
        } satisfies Story;
        
        export const RenderNoArgs = {
        
      +   args: {
      +     bordered: true,
      +     initial: "test1",
      +   },
      + 
      + 
          render: (args) => <MyComponent {...args} />,
        } satisfies Story;
        
        export const RenderArgs = {
          args: {
            absolute: true,
        
      +     bordered: true,
      +     initial: "test1",
      + 
          },
          render: (args) => <MyComponent {...args} />,
        } satisfies Story;
        
        export const RenderExistingArgs = {
          args: {
            absolute: true,
            bordered: true,
        
      -     initial: "test2",
      - 
      +     initial: "test1",
      + 
          },
          render: (args) => <MyComponent {...args} />,
        } satisfies Story;
        
        // The order of both the properties of the story and the order of args should be preserved
        export const OrderedArgs = {
          args: {
            bordered: true,
        
      -     initial: "test2",
      - 
      +     initial: "test1",
      + 
            absolute: true,
          },
          render: (args) => <MyComponent {...args} />,
        } satisfies Story;
      ...
        export const HasPlayFunction = {
          args: {
            bordered: true,
        
      -     initial: "test2",
      - 
      +     initial: "test1",
      + 
            absolute: true,
          },
          play: async ({ canvasElement }) => {
            console.log("play");
        ..."
    `);
  });
  test('CSF4 Variances', async () => {
    const newArgs = { bordered: true, initial: 'test1' };

    const before = await format(await readFile(FILES.csf4Variances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.csf4Variances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);
    const nodes = names.map((name) => CSF.getStoryExport(name));

    nodes.forEach((node) => {
      updateArgsInCsfFile(node, newArgs);
    });

    const after = await format(printCsf(parsed).code, {
      parser: 'typescript',
    });

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    // TODO, the comment is not preserved!!!
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
            initial: "foo",
          },
        });
        
      - export const Empty = meta.story({});
      - 
      + export const Empty = meta.story({
      +   args: {
      +     bordered: true,
      +     initial: "test1",
      +   },
      + });
      + 
        export const WithArgs = meta.story({
          args: {
            foo: "bar",
        
      +     bordered: true,
      +     initial: "test1",
      + 
          },
        });
        export const Typed = meta.type<{ args: { icon: string } }>().story({
          args: {
            icon: "star",
        
      +     bordered: true,
      +     initial: "test1",
      + 
          },
        });
        "
    `);
  });
  test('Export Variances', async () => {
    const newArgs = { bordered: true, initial: 'test1' };

    const before = await format(await readFile(FILES.exportVariances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.exportVariances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);
    const nodes = names.map((name) => CSF.getStoryExport(name));

    nodes.forEach((node) => {
      if (node === undefined) {
        return;
      }
      updateArgsInCsfFile(node, newArgs);
    });

    const after = await format(printCsf(parsed).code, {
      parser: 'typescript',
    });

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    // TODO this is incomplete due to no support for export variances in csf-tools
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        
        export const DirectExport: Story = {
          args: {
        
      -     initial: "bar",
      - 
      +     initial: "test1",
      +     bordered: true,
      + 
          },
        };
        
        const BlockExport: Story = {
        ..."
    `);
  });
  test('Data Variances', async () => {
    const newArgs = {
      myArray: ['FOO', 'BAR'],
      myArrayDeep: [['FOO'], ['BAR']],
      myBoolean: true,
      myFunction: () => {},
      myNull: null,
      myNumber: 41,
      myObject: {
        FOO: 'BAR',
      },
      myString: 'FOO',
      myUndefined: undefined,
    };

    const before = await format(await readFile(FILES.dataVariances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.dataVariances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);
    const nodes = names.map((name) => CSF.getStoryExport(name));

    nodes.forEach((node) => {
      if (node === undefined) {
        return;
      }
      updateArgsInCsfFile(node, newArgs);
    });

    const after = await format(printCsf(parsed).code, {
      parser: 'typescript',
    });

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        
        export const All = {
          args: {
        
      -     myArray: ["foo", "bar"],
      -     myArrayDeep: [["foo"], ["bar"]],
      - 
      +     myArray: ["FOO", "BAR"],
      +     myArrayDeep: [["FOO"], ["BAR"]],
      + 
            myBoolean: true,
            myFunction: () => {},
            myNull: null,
        
      -     myNumber: 42,
      - 
      +     myNumber: 41,
      + 
            myObject: {
        
      -       foo: "bar",
      - 
      +       FOO: "BAR",
      + 
            },
        
      -     myString: "foo",
      - 
      +     myString: "FOO",
      + 
            myUndefined: undefined,
          },
        } satisfies Story;
        
        export const None = {
        
      -   args: {},
      - 
      +   args: {
      +     myArray: ["FOO", "BAR"],
      +     myArrayDeep: [["FOO"], ["BAR"]],
      +     myBoolean: true,
      +     myFunction: () => {},
      +     myNull: null,
      +     myNumber: 41,
      + 
      +     myObject: {
      +       FOO: "BAR",
      +     },
      + 
      +     myString: "FOO",
      +     myUndefined: undefined,
      +   },
      + 
        } satisfies Story;
        "
    `);
  });
});

describe.each([
  ['CSF3', (object: string) => object],
  ['CSF3 satisfies', (object: string) => `${object} satisfies Story`],
  ['CSF4', (object: string) => `meta.story(${object})`],
] as const)('%s spread args', (format, story) => {
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
  ])('rejects saving through a function-call spread: %s', async (properties) => {
    const node = parser.parseExpression(story(`{ ${properties} }`), { plugins: ['typescript'] });
    const before = generate(node).code;

    await expect(updateArgsInCsfFile(node, { label: 'saved' })).rejects.toThrow(SaveStoryError);

    expect(generate(node).code).toBe(before);
  });

  test('updates args after a function-call spread without repeating the call', async () => {
    const node = parser.parseExpression(story('{ ...makeBase(), args: { label: "old" } }'), {
      plugins: ['typescript'],
    });
    const makeBase = vi.fn(() => ({ args: { label: 'base' } }));

    await updateArgsInCsfFile(node, { label: 'saved' });

    const { code } = transformSync(`(${generate(node).code})`, { loader: 'ts' });
    const result = runInNewContext(code, { makeBase, meta: { story: (input: unknown) => input } });
    expect(result.args).toEqual({ label: 'saved' });
    expect(makeBase).toHaveBeenCalledOnce();
  });

  const onClick = () => {};
  const inheritedArgs = { size: 'small', baseOnly: true, onClick };

  test.each([
    [
      'merges args from multiple spreads',
      '...Base, parameters: { layout: "centered" }, ...Override',
      inheritedArgs,
    ],
    ['inherits args from a single spread', '...Base', { size: 'large', baseOnly: true }],
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
    [
      'merges args when a later spread has undefined args',
      '...Base, ...Cleared',
      { size: 'large', baseOnly: true },
    ],
    [
      'preserves existing args when a later spread has none',
      'args: { size: "small" }, ...WithoutArgs',
      { size: 'small' },
    ],
    [
      'moves existing args past spreads',
      'args: { label: "old", size: "medium", disabled: true }, ...Base, ...Override',
      { ...inheritedArgs, disabled: true },
    ],
    [
      'merges args between spreads in source order',
      '...Base, args: { label: "old", size: "medium", disabled: true }, ...Override',
      { ...inheritedArgs, disabled: true },
    ],
    [
      'updates args already after spreads',
      '...Base, ...Override, args: { label: "old", disabled: true }',
      { disabled: true },
    ],
  ])('%s', async (_, properties, expectedArgs) => {
    const csf = loadCsf(
      `${
        format === 'CSF4'
          ? `import preview from '#.storybook/preview'; const meta = preview.meta({ title: 'Button' });`
          : `export default { title: 'Button' };`
      }
       export const Saved = ${story(`{ ${properties}, name: 'Saved story' }`)};`,
      { makeTitle }
    ).parse();
    const context = {
      Base: { args: { label: 'base', size: 'large', baseOnly: true } },
      Override: { args: { label: 'override', size: 'small', onClick } },
      WithoutArgs: { parameters: { layout: 'centered' } },
      UndefinedBase: undefined,
      NullBase: null,
      Cleared: { args: undefined },
      meta: { story: (input: unknown) => input },
    };
    const newArgs = { label: 'saved' };

    await updateArgsInCsfFile(csf.getStoryExport('Saved'), newArgs);

    const saved = loadCsf(printCsf(csf).code, { makeTitle }).parse();
    const expression = generate(saved.getStoryExport('Saved')).code;
    const { code } = transformSync(`(${expression})`, { loader: 'ts' });
    const result = runInNewContext(code, context);

    expect(result.args).toEqual({ ...expectedArgs, ...newArgs });
    expect(result.name).toBe('Saved story');

    await updateArgsInCsfFile(saved.getStoryExport('Saved'), newArgs);
    expect(printCsf(saved).code).toBe(printCsf(csf).code);

    await updateArgsInCsfFile(saved.getStoryExport('Saved'), { label: 'saved again' });
    const updatedExpression = generate(saved.getStoryExport('Saved')).code;
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

  await updateArgsInCsfFile(csf.getStoryExport('Saved'), { label: 'saved' });

  expect(await format(printCsf(csf).code, { parser: 'typescript' })).toMatchInlineSnapshot(`
    "export default { title: "Button" };
    export const Saved = {
      ...Base,

      args: {
        ...Base?.args,
        label: "saved",
      },
    };
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

  await updateArgsInCsfFile(csf.getStoryExport('Saved'), { label: 'saved' });

  expect(await format(printCsf(csf).code, { parser: 'typescript' })).toMatchInlineSnapshot(`
    "import preview from "#.storybook/preview";
    const meta = preview.meta({ title: "Button" });
    export const Saved = meta.story({
      ...Base.input,

      args: {
        ...Base.input?.args,
        label: "saved",
      },
    });
    "
  `);
  const expression = generate(csf.getStoryExport('Saved')).code;
  const result = runInNewContext(`(${expression})`, {
    Base: { input: { args: { label: 'base', size: 'large' } } },
    meta: { story: (input: unknown) => input },
  });
  expect(result.args).toEqual({ label: 'saved', size: 'large' });
});

describe('story expressions', () => {
  test.each([
    'meta.story({ args: { label: "old" } }) as Story',
    'meta.story({ args: { label: "old" } } satisfies Story)',
    'Base.extend({ args: { label: "old" } })',
  ])('updates the story object in %s', async (source) => {
    const node = parser.parseExpression(source, { plugins: ['typescript'] });

    await updateArgsInCsfFile(node, { label: 'saved' });

    const { code } = transformSync(`(${generate(node).code})`, { loader: 'ts' });
    const result = runInNewContext(code, {
      meta: { story: (input: unknown) => input },
      Base: { extend: (input: unknown) => input },
    });
    expect(result.args).toEqual({ label: 'saved' });
  });

  test.each([
    'meta.story(withDefaults({ args: { label: "old" } }))',
    'meta.story()',
    'meta.story(storyArgs)',
    'meta.story(...[{ args: { label: "old" } }])',
  ])('leaves unsupported story inputs unchanged: %s', async (source) => {
    const node = parser.parseExpression(source);
    const before = generate(node).code;

    await updateArgsInCsfFile(node, { label: 'saved' });

    expect(generate(node).code).toBe(before);
  });

  test('rejects a CSF2 story wrapped in a type assertion', async () => {
    const node = parser.parseExpression('Template.bind({}) as Story', { plugins: ['typescript'] });

    await expect(updateArgsInCsfFile(node, { label: 'saved' })).rejects.toThrow(SaveStoryError);
  });

  test('updates only top-level CSF4 args', async () => {
    const node = parser.parseExpression(`meta.story({
      args: { label: 'old', options: { label: 'nested' } },
      parameters: { args: { label: 'parameter' } },
    })`);

    await updateArgsInCsfFile(node, { label: 'saved' });

    const result = runInNewContext(`(${generate(node).code})`, {
      meta: { story: (input: unknown) => input },
    });
    expect(result).toEqual({
      args: { label: 'saved', options: { label: 'nested' } },
      parameters: { args: { label: 'parameter' } },
    });
  });
});
