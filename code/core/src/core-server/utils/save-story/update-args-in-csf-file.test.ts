import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { loadCsf, parseExpression, printCsf, readCsf } from 'storybook/internal/csf-tools';

import { format } from 'prettier';

import { duplicateStoryWithNewName } from './duplicate-story-with-new-name.ts';
import { getDiff } from './getDiff.ts';
import { updateArgsInCsfFile } from './update-args-in-csf-file.ts';
import { SaveStoryError, assertApplied } from './utils.ts';

const makeTitle = (userTitle: string) => userTitle;

const FILES = {
  typescriptConstructs: join(__dirname, 'mocks/typescript-constructs.stories.tsx'),
  csfVariances: join(__dirname, 'mocks/csf-variances.stories.tsx'),
  csf4Variances: join(__dirname, 'mocks/csf4-variances.stories.tsx'),
  csf2Variances: join(__dirname, 'mocks/csf2-variances.stories.tsx'),
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

    names.forEach((name) => {
      updateArgsInCsfFile(parsed, name, newArgs);
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
  test('re-exported story', () => {
    const parsed = loadCsf(
      `export default { title: 'X' };\nconst Local = { args: { a: 1 } };\nexport { Local as Alias };`,
      { makeTitle }
    ).parse();

    updateArgsInCsfFile(parsed, 'Alias', { a: 2 });

    expect(printCsf(parsed).code).toMatchInlineSnapshot(`
      "export default { title: 'X' };
      const Local = { args: { a: 2 } };
      export { Local as Alias };"
    `);
  });
  test('story whose args spread another story', () => {
    const parsed = loadCsf(
      [
        `export default { title: 'X' };`,
        `export const Base = { args: { a: 1 } };`,
        `export const Spread = { ...Base };`,
        `export const SpreadArgs = { args: { ...Base.args, a: 2 } };`,
      ].join('\n'),
      { makeTitle }
    ).parse();

    updateArgsInCsfFile(parsed, 'Spread', { b: 2 });
    updateArgsInCsfFile(parsed, 'SpreadArgs', { a: 3, b: 3 });

    expect(printCsf(parsed).code).toMatchInlineSnapshot(`
      "export default { title: 'X' };
      export const Base = { args: { a: 1 } };
      export const Spread = { ...Base, args: { ...Base.args, b: 2 } };
      export const SpreadArgs = { args: { ...Base.args, a: 3, b: 3 } };"
    `);
  });
  test('refuses an arg a later spread could override, leaving the story as it was', () => {
    const source = [
      `export default { title: 'X' };`,
      `export const Base = { args: { a: 1 } };`,
      `export const A = { args: { a: 1, ...Base.args } };`,
    ].join('\n');
    const parsed = loadCsf(source, { makeTitle }).parse();

    expect(() =>
      updateArgsInCsfFile(parsed, 'A', { c: 2, a: 2 })
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cannot save arg "a" of story A because a spread in the story could override it.]`
    );
    expect(printCsf(parsed).code).toBe(source);
    expect(parsed.changed).toBe(false);
  });
  test('story exported under two names is saved through its first export', () => {
    const parsed = loadCsf(
      [
        `export default { title: 'X' };`,
        `export const Primary = { args: { a: 1 } };`,
        `export { Primary as Secondary };`,
      ].join('\n'),
      { makeTitle }
    ).parse();

    updateArgsInCsfFile(parsed, 'Primary', { a: 2 });

    expect(printCsf(parsed).code).toMatchInlineSnapshot(`
      "export default { title: 'X' };
      export const Primary = { args: { a: 2 } };
      export { Primary as Secondary };"
    `);
  });
  test('refuses the second export of a story, leaving the file as it was', () => {
    const source = [
      `export default { title: 'X' };`,
      `export const Primary = { args: { a: 1 } };`,
      `export { Primary as Secondary };`,
    ].join('\n');
    const parsed = loadCsf(source, { makeTitle }).parse();

    expect(() =>
      updateArgsInCsfFile(parsed, 'Secondary', { a: 2 })
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cannot save story Secondary because it is the same story as Primary. Save Primary instead.]`
    );
    expect(printCsf(parsed).code).toBe(source);
    expect(parsed.changed).toBe(false);
  });
  test('arg value shaped like an AST node is written as data', () => {
    const parsed = loadCsf(`export default { title: 'X' };\nexport const A = {};`, {
      makeTitle,
    }).parse();

    updateArgsInCsfFile(parsed, 'A', { node: { type: 'Identifier', name: 'x' } });

    expect(printCsf(parsed).code).toMatchInlineSnapshot(`
      "export default { title: 'X' };
      export const A = { args: { node: { type: 'Identifier', name: 'x' } } };"
    `);
  });
  test('factory story without an argument', () => {
    const parsed = loadCsf(
      [
        `import preview from '#.storybook/preview';`,
        `const meta = preview.meta({ title: 'X' });`,
        `export const A = meta.story();`,
      ].join('\n'),
      { makeTitle }
    ).parse();

    updateArgsInCsfFile(parsed, 'A', { a: 1, b: 'x' });

    expect(printCsf(parsed).code).toMatchInlineSnapshot(`
      "import preview from '#.storybook/preview';
      const meta = preview.meta({ title: 'X' });
      export const A = meta.story({ args: { a: 1, b: 'x' } });"
    `);
  });
  test('new story from a factory story without an argument', () => {
    const parsed = loadCsf(
      [
        `import preview from '#.storybook/preview';`,
        `const meta = preview.meta({ title: 'X' });`,
        `export const A = meta.story();`,
      ].join('\n'),
      { makeTitle }
    ).parse();

    duplicateStoryWithNewName(parsed, 'A', 'B');
    updateArgsInCsfFile(parsed, 'B', { a: 1 });

    expect(printCsf(parsed).code).toMatchInlineSnapshot(`
      "import preview from '#.storybook/preview';
      const meta = preview.meta({ title: 'X' });
      export const A = meta.story();
      export const B = meta.story({ args: { a: 1 } });"
    `);
  });
  test('reports why a story cannot be edited', () => {
    const parsed = loadCsf(
      [
        `import preview from '#.storybook/preview';`,
        `const meta = preview.meta({ title: 'X' });`,
        `const config = {};`,
        `export const A = meta.story(config);`,
      ].join('\n'),
      { makeTitle }
    ).parse();

    expect(() => updateArgsInCsfFile(parsed, 'A', { a: 1 })).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cannot save story A because its configuration is not written inline in this file.]`
    );
  });
  test('CSF2 Variances', async () => {
    const newArgs = { bordered: true, initial: 'test1' };

    const before = await format(await readFile(FILES.csf2Variances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.csf2Variances, { makeTitle });
    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);

    names.forEach((name) => {
      updateArgsInCsfFile(parsed, name, newArgs);
    });

    const after = await format(printCsf(parsed).code, {
      parser: 'typescript',
    });

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        }> = (props) => <pre>{JSON.stringify(props)}</pre>;
        
        export const CSF2 = () => <MyComponent absolute bordered initial="test2" />;
        
      + CSF2.args = { bordered: true, initial: "test1" };
      + 
        
        export const CSF2b = CSF2.bind({});
        
      + CSF2b.args = { bordered: true, initial: "test1" };
      + "
    `);
  });
  test('CSF Variances', async () => {
    const newArgs = { bordered: true, initial: 'test1' };

    const before = await format(await readFile(FILES.csfVariances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.csfVariances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);

    names.forEach((name) => {
      updateArgsInCsfFile(parsed, name, newArgs);
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
      +   args: { bordered: true, initial: "test1" },
      + } satisfies Story;
      + 
        
        export const EmptyWithComment = {
          // this is a useless comment, to test that it is preserved
        
      +   args: { bordered: true, initial: "test1" },
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
          render: (args) => <MyComponent {...args} />,
        
      +   args: { bordered: true, initial: "test1" },
      + 
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

    names.forEach((name) => {
      updateArgsInCsfFile(parsed, name, newArgs);
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
      + export const Empty = meta.story({ args: { bordered: true, initial: "test1" } });
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

    names.forEach((name) => {
      updateArgsInCsfFile(parsed, name, newArgs);
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
          args: {
        
      -     initial: "bar",
      - 
      +     initial: "test1",
      +     bordered: true,
      + 
          },
        };
        
        const NotYetRenamedExport: Story = {
          args: {
        
      -     initial: "bar",
      - 
      +     initial: "test1",
      +     bordered: true,
      + 
          },
        };
        
        export { BlockExport, NotYetRenamedExport as RenamedExport };
        ..."
    `);
  });
  test('Data Variances', async () => {
    const newArgs = {
      myArray: ['FOO', 'BAR'],
      myArrayDeep: [['FOO'], ['BAR']],
      myBoolean: true,
      myFunction: parseExpression('() => {}'),
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

    names.forEach((name) => {
      updateArgsInCsfFile(parsed, name, newArgs);
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
      -     myObject: {
      -       foo: "bar",
      -     },
      -     myString: "foo",
      - 
      +     myNumber: 41,
      +     myObject: { FOO: "BAR" },
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
      +     myObject: { FOO: "BAR" },
      +     myString: "FOO",
      +     myUndefined: undefined,
      +   },
      + 
        } satisfies Story;
        "
    `);
  });
});

describe('refusal messages', () => {
  // Saves `a: 2` on `story` of `source`, and returns the error the controls panel shows.
  const refusal = (source: string[], story = 'A') => {
    const code = [`export default { title: 'X' };`, ...source].join('\n');
    const parsed = loadCsf(code, { makeTitle }).parse();
    let error: unknown;
    try {
      updateArgsInCsfFile(parsed, story, { a: 2 });
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(SaveStoryError);
    expect(printCsf(parsed).code).toBe(code);
    return error as SaveStoryError;
  };

  test('names the arg a spread could override, and keeps the diagnostic as the cause', () => {
    const error = refusal([
      `const Base = { args: {} };`,
      `export const A = { args: { a: 1, ...Base.args } };`,
    ]);
    expect(error.message).toBe(
      'Cannot save arg "a" of story A because a spread in the story could override it.'
    );
    expect(error.cause).toMatchObject({
      code: 'spread-field',
      message: 'Cannot mutate args.a because the target contains spread field',
    });
  });

  test('explains args in a constant that other stories share', () => {
    expect(
      refusal([
        `const shared = { a: 1 };`,
        `export const A = { args: shared };`,
        `export const B = { args: shared };`,
      ]).message
    ).toBe(
      'Cannot save arg "a" of story A because the args of the story are not an object written in the story itself, for example a constant that other stories share.'
    );
  });

  test('explains two args fields', () => {
    expect(refusal([`export const A = { args: { a: 1 }, args: { b: 1 } };`]).message).toBe(
      'Cannot save arg "a" of story A because the story sets it more than once.'
    );
  });

  test('names the story an alias stands for', () => {
    expect(refusal([`export const P = { args: { a: 1 } };`, `export const A = P;`]).message).toBe(
      'Cannot save story A because it is the same story as P. Save P instead.'
    );
  });

  test('explains an alias of a binding that is not a story of its own', () => {
    expect(
      refusal([`const Local = { args: { a: 1 } };`, `export { Local as A, Local as B };`], 'B')
        .message
    ).toBe(
      'Cannot save story B because it is another name for a story in this file. Save that story instead.'
    );
  });

  test('explains a story that other code in the file changes', () => {
    expect(refusal([`export const A = { args: {} };`, `A.args.x = 1;`]).message).toBe(
      'Cannot save story A because other code in the file changes or shares the story.'
    );
  });

  test('explains a story re-exported from another file', () => {
    expect(refusal([`export { A } from './other';`]).message).toBe(
      'Cannot save story A because its configuration is not written inline in this file.'
    );
  });

  test('explains an edit that would leave an invalid story file', () => {
    const parsed = loadCsf(`export default { title: 'X' };\nexport const A = {};`, {
      makeTitle,
    }).parse();
    const diagnostic = {
      code: 'invalid-csf',
      target: { kind: 'story', exportName: 'A', localName: 'A' },
      path: ['args', 'a'],
      message: 'Edited args.a, but the result is not valid CSF: reason',
    } as const;
    expect(() =>
      assertApplied(parsed, 'A', { ok: false, changed: false, diagnostic })
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cannot save arg "a" of story A because the result would not be a valid story file.]`
    );
    expect(() =>
      assertApplied(parsed, 'A', {
        ok: false,
        changed: false,
        diagnostic: { ...diagnostic, code: 'cyclic-move' },
      })
    ).toThrowError(diagnostic.message);
  });
});
