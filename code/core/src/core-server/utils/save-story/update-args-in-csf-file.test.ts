import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { printCsf, readCsf } from 'storybook/internal/csf-tools';

import { format } from 'prettier';

import { getDiff } from './getDiff.ts';
import { updateArgsInCsfFile } from './update-args-in-csf-file.ts';

const makeTitle = (userTitle: string) => userTitle;

const FILES = {
  typescriptConstructs: join(__dirname, 'mocks/typescript-constructs.stories.tsx'),
  csfVariances: join(__dirname, 'mocks/csf-variances.stories.tsx'),
  csf4Variances: join(__dirname, 'mocks/csf4-variances.stories.tsx'),
  unsupportedCsfVariances: join(__dirname, 'mocks/unsupported-csf-variances.stories.tsx'),
  exportVariances: join(__dirname, 'mocks/export-variances.stories.tsx'),
  dataVariances: join(__dirname, 'mocks/data-variances.stories.tsx'),
  kebabCaseArgs: join(__dirname, 'mocks/kebab-case-args.stories.tsx'),
  kebabCaseArgsCsf4: join(__dirname, 'mocks/kebab-case-args-csf4.stories.tsx'),
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
  test('Kebab-case args', async () => {
    const newArgs = {
      'data-testid': 'after',
      'aria-label': 'button',
      label: 'bar',
      '123': 'baz',
      default: 'reserved',
      '123abc': 'mixed',
    };

    const before = await format(await readFile(FILES.kebabCaseArgs, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.kebabCaseArgs, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);
    const nodes = names.map((name) => CSF.getStoryExport(name));

    nodes.forEach((node) => {
      updateArgsInCsfFile(node, newArgs);
    });

    const rawAfter = printCsf(parsed).code;

    // reserved-word keys are emitted quoted; prettier strips the optional quotes below
    expect(rawAfter).toContain('"default":');

    // formatting would throw if the generated keys were emitted unquoted
    const after = await format(rawAfter, {
      parser: 'typescript',
    });

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
          123: string;
        }> = (props) => <pre>{JSON.stringify(props)}</pre>;
        
        
      - export const NoArgs = {} satisfies Story;
      - 
      + export const NoArgs = {
      +   args: {
      +     "123": "baz",
      +     "data-testid": "after",
      +     "aria-label": "button",
      +     label: "bar",
      +     default: "reserved",
      +     "123abc": "mixed",
      +   },
      + } satisfies Story;
      + 
        
        export const QuotedKebabArg = {
          args: {
        
      -     "data-testid": "before",
      -     label: "foo",
      - 
      +     "data-testid": "after",
      +     label: "bar",
      +     "123": "baz",
      +     "aria-label": "button",
      +     default: "reserved",
      +     "123abc": "mixed",
      + 
          },
        } satisfies Story;
        
        export const NumericKeyArg = {
          args: {
        
      -     123: "before",
      - 
      +     123: "baz",
      +     "data-testid": "after",
      +     "aria-label": "button",
      +     label: "bar",
      +     default: "reserved",
      +     "123abc": "mixed",
      + 
          },
        } satisfies Story;
        "
    `);
  });
  test('Kebab-case args (CSF4)', async () => {
    const newArgs = { 'aria-label': 'button' };

    const before = await format(await readFile(FILES.kebabCaseArgsCsf4, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.kebabCaseArgsCsf4, { makeTitle });

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

    // check if the code was updated correctly: the nested 'aria-label' must stay
    // untouched and the new arg must be added at the top level
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        export const QuotedKebabArg = meta.story({
          args: {
            "data-testid": "before",
        
      +     "aria-label": "button",
      + 
          },
        });
        export const NestedCollision = meta.story({
          args: {
            nested: {
              "aria-label": "inner",
            },
        
      + 
      +     "aria-label": "button",
      + 
          },
        });
        "
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
