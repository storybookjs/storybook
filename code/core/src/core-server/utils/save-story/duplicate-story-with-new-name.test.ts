import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { loadCsf, printCsf, readCsf } from 'storybook/internal/csf-tools';

import { format } from 'prettier';

import { duplicateStoryWithNewName } from './duplicate-story-with-new-name.ts';
import { getDiff } from './getDiff.ts';
import { SaveStoryError } from './utils.ts';

const makeTitle = (userTitle: string) => userTitle;

const FILES = {
  csfVariances: join(__dirname, 'mocks/csf-variances.stories.tsx'),
  csf4Variances: join(__dirname, 'mocks/csf4-variances.stories.tsx'),
  csf2Variances: join(__dirname, 'mocks/csf2-variances.stories.tsx'),
  typescriptConstructs: join(__dirname, 'mocks/typescript-constructs.stories.tsx'),
};

describe('success', () => {
  test('CSF Variances', async () => {
    const before = await format(await readFile(FILES.csfVariances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.csfVariances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);

    names.forEach((name) => {
      duplicateStoryWithNewName(parsed, name, name + 'Duplicated');
    });

    const after = await format(printCsf(parsed).code, {
      parser: 'typescript',
    });

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
            canvasElement.style.backgroundColor = "red";
          },
        } satisfies Story;
        
      + 
      + export const EmptyDuplicated = {} satisfies Story;
      + 
      + export const EmptyWithCommentDuplicated = {
      +   // this is a useless comment, to test that it is preserved
      + } satisfies Story;
      + 
      + export const OnlyArgsDuplicated = {
      +   args: {},
      + } satisfies Story;
      + 
      + export const RenderNoArgsDuplicated = {
      +   render: (args) => <MyComponent {...args} />,
      + } satisfies Story;
      + 
      + export const RenderArgsDuplicated = {
      +   args: {},
      +   render: (args) => <MyComponent {...args} />,
      + } satisfies Story;
      + 
      + export const RenderExistingArgsDuplicated = {
      +   args: {},
      +   render: (args) => <MyComponent {...args} />,
      + } satisfies Story;
      + 
      + export const OrderedArgsDuplicated = {
      +   args: {},
      +   render: (args) => <MyComponent {...args} />,
      + } satisfies Story;
      + 
      + export const HasPlayFunctionDuplicated = {
      +   args: {},
      +   play: async ({ canvasElement }) => {
      +     console.log("play");
      + 
      +     canvasElement.style.backgroundColor = "red";
      +   },
      + } satisfies Story;
      + "
    `);
  });
  test('CSF4 Variances', async () => {
    const before = await format(await readFile(FILES.csf4Variances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.csf4Variances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);

    names.forEach((name) => {
      duplicateStoryWithNewName(parsed, name, name + 'Duplicated');
    });

    const after = await format(printCsf(parsed).code, {
      parser: 'typescript',
    });

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
            icon: "star",
          },
        });
        
      + 
      + export const EmptyDuplicated = meta.story({});
      + 
      + export const WithArgsDuplicated = meta.story({
      +   args: {},
      + });
      + 
      + export const TypedDuplicated = meta.type<{ args: { icon: string } }>().story({
      +   args: {},
      + });
      + "
    `);
  });
  test('refuses CSF2 Variances', async () => {
    const CSF = await readCsf(FILES.csf2Variances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);

    for (const name of names) {
      await expect(() => duplicateStoryWithNewName(parsed, name, name + 'Duplicated')).toThrow();
    }
  });
  test('refuses a CSF2 story wrapped in a type assertion', () => {
    const parsed = loadCsf(
      [
        `export default { title: 'A' };`,
        `export const A = ((args) => null) as Story;`,
        `A.parameters = { layout: 'centered' };`,
      ].join('\n'),
      { makeTitle }
    ).parse();
    expect(() => duplicateStoryWithNewName(parsed, 'A', 'B')).toThrowErrorMatchingInlineSnapshot(
      `[Error: Creating a new story based on a CSF2 story is not supported]`
    );
  });
  test('Typescript Constructs', async () => {
    const before = await format(await readFile(FILES.typescriptConstructs, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.typescriptConstructs, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);

    names.forEach((name) => {
      duplicateStoryWithNewName(parsed, name, name + 'Duplicated');
    });

    const after = await format(printCsf(parsed).code, {
      parser: 'typescript',
    });

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
            initial: "bar",
          },
        };
        
      + 
      + export const CastDuplicated: Story = {
      +   args: {},
      + };
      + 
      + export const AsDuplicated = {
      +   args: {},
      + } as Story;
      + 
      + export const SatisfiesDuplicated = {
      +   args: {},
      + } satisfies Story;
      + 
      + export const NoneDuplicated = {
      +   args: {},
      + };
      + "
    `);
  });
  test('empties the args member only, not a computed key named args', () => {
    const parsed = loadCsf(
      [
        `export default { title: 'A' };`,
        `const args = 'label';`,
        `export const A = { args: { label: 'a' }, parameters: { [args]: 1 } };`,
      ].join('\n'),
      { makeTitle }
    ).parse();
    duplicateStoryWithNewName(parsed, 'A', 'B');
    expect(printCsf(parsed).code).toContain(
      `export const B = { args: {}, parameters: { [args]: 1 } };`
    );
  });
  test('leaves out the name and keeps args nested in other fields', () => {
    const parsed = loadCsf(
      [
        `export default { title: 'A' };`,
        `export const A = { name: 'Fancy', args: { a: 1 }, parameters: { docs: { args: 1 } } };`,
      ].join('\n'),
      { makeTitle }
    ).parse();
    duplicateStoryWithNewName(parsed, 'A', 'B');
    expect(printCsf(parsed).code).toContain(
      `export const B = { args: {}, parameters: { docs: { args: 1 } } };`
    );
  });
  test('empties args after a spread of another story, so the copy does not inherit them', () => {
    const parsed = loadCsf(
      [
        `export default { title: 'A' };`,
        `export const Base = { args: { a: 1 } };`,
        `export const A = { ...Base, args: { a: 2 } };`,
      ].join('\n'),
      { makeTitle }
    ).parse();
    duplicateStoryWithNewName(parsed, 'A', 'B');
    expect(printCsf(parsed).code).toContain(`export const B = { ...Base, args: {} };`);
  });
  test('names a copy after its export when a spread before its name would provide one', () => {
    const parsed = loadCsf(
      [
        `export default { title: 'A' };`,
        `export const Base = { name: 'Base story' };`,
        `export const A = { ...Base, name: 'Fancy' };`,
      ].join('\n'),
      { makeTitle }
    ).parse();
    duplicateStoryWithNewName(parsed, 'A', 'MyCopy');
    expect(printCsf(parsed).code).toContain(`export const MyCopy = { ...Base, name: 'My Copy' };`);
  });
  test('copies a story exported under a name other than its binding', () => {
    const parsed = loadCsf(
      [
        `export default { title: 'A' };`,
        `const Local = { args: { a: 1 } };`,
        `export { Local as A };`,
      ].join('\n'),
      { makeTitle }
    ).parse();
    duplicateStoryWithNewName(parsed, 'A', 'B');
    expect(printCsf(parsed).code.split('\n').at(-1)).toBe(`export const B = { args: {} };`);
  });
});

describe('refuses before it adds the copy', () => {
  const refused = (source: string[], storyName: string, newStoryName: string) => {
    const code = [`export default { title: 'A' };`, ...source].join('\n');
    const parsed = loadCsf(code, { makeTitle }).parse();
    expect(() => duplicateStoryWithNewName(parsed, storyName, newStoryName)).toThrowError(
      SaveStoryError
    );
    expect(printCsf(parsed).code).toBe(code);
    expect(parsed.changed).toBe(false);
    try {
      duplicateStoryWithNewName(parsed, storyName, newStoryName);
    } catch (error) {
      return (error as Error).message;
    }
  };

  test('a name an import of the file uses', () => {
    expect(
      refused(
        [`import { Button } from './Button';`, `export const A = { args: {} };`],
        'A',
        'Button'
      )
    ).toBe(
      'Cannot create story Button because the file already uses the name Button. Choose another name.'
    );
  });

  test('a name a local of the file uses', () => {
    expect(
      refused([`const helper = () => {};`, `export const A = { args: {} };`], 'A', 'helper')
    ).toBe(
      'Cannot create story helper because the file already uses the name helper. Choose another name.'
    );
  });

  test('a story that is another name for a story', () => {
    expect(
      refused(
        [`export const Primary = { args: { a: 1 } };`, `export const Secondary = Primary;`],
        'Secondary',
        'New'
      )
    ).toBe(
      'Cannot create a story from Secondary because it is the same story as Primary. Create the new story from Primary instead.'
    );
  });

  test('a story that is a second export of a story', () => {
    expect(
      refused(
        [`export const Primary = { args: { a: 1 } };`, `export { Primary as Secondary };`],
        'Secondary',
        'New'
      )
    ).toBe(
      'Cannot create a story from Secondary because it is the same story as Primary. Create the new story from Primary instead.'
    );
  });
});

describe('the name of the copy', () => {
  const copyOf = (source: string[]) => {
    const parsed = loadCsf([`export default { title: 'A' };`, ...source].join('\n'), {
      makeTitle,
    }).parse();
    duplicateStoryWithNewName(parsed, 'A', 'MyCopy');
    return printCsf(parsed).code.split('\n').at(-1);
  };

  test('is set after a spread that provides a name', () => {
    expect(
      copyOf([
        `const Base = { name: 'Base story', args: { a: 1 } };`,
        `export const A = { ...Base, args: { a: 2 } };`,
      ])
    ).toBe(`export const MyCopy = { ...Base, args: {}, name: 'My Copy' };`);
  });

  test('is left as it is when a later spread could override it', () => {
    expect(
      copyOf([`import { Base } from './Base';`, `export const A = { name: 'Nice', ...Base };`])
    ).toBe(`export const MyCopy = { name: 'Nice', ...Base };`);
  });
});

describe('factory stories', () => {
  test('copies a story made with extend', () => {
    const parsed = loadCsf(
      [
        `import preview from '#.storybook/preview';`,
        `const meta = preview.meta({ title: 'X' });`,
        `export const A = meta.story({ args: { a: 1 } });`,
        `export const B = A.extend({ args: { b: 1 } });`,
      ].join('\n'),
      { makeTitle }
    ).parse();

    duplicateStoryWithNewName(parsed, 'B', 'C');

    expect(printCsf(parsed).code.split('\n').at(-1)).toBe(
      `export const C = A.extend({ args: {} });`
    );
  });
});
