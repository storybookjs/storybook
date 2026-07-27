import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { loadCsf, printCsf, readCsf } from 'storybook/internal/csf-tools';

import { format } from 'prettier';

import { duplicateStoryWithNewName } from './duplicate-story-with-new-name.ts';
import { getDiff } from './getDiff.ts';

const makeTitle = (userTitle: string) => userTitle;

const FILES = {
  csfVariances: join(__dirname, 'mocks/csf-variances.stories.tsx'),
  csf4Variances: join(__dirname, 'mocks/csf4-variances.stories.tsx'),
  nameVariances: join(__dirname, 'mocks/name-variances.stories.tsx'),
  csf4NameVariances: join(__dirname, 'mocks/csf4-name-variances.stories.tsx'),
  unsupportedCsfVariances: join(__dirname, 'mocks/unsupported-csf-variances.stories.tsx'),
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
        
      + export const EmptyDuplicated = {} satisfies Story;
      + export const EmptyWithCommentDuplicated = {} satisfies Story;
      + export const OnlyArgsDuplicated = {} satisfies Story;
      + 
      + export const RenderNoArgsDuplicated = {
      +   render: (args) => <MyComponent {...args} />,
      + } satisfies Story;
      + 
      + export const RenderArgsDuplicated = {
      +   render: (args) => <MyComponent {...args} />,
      + } satisfies Story;
      + 
      + export const RenderExistingArgsDuplicated = {
      +   render: (args) => <MyComponent {...args} />,
      + } satisfies Story;
      + 
      + export const OrderedArgsDuplicated = {
      +   render: (args) => <MyComponent {...args} />,
      + } satisfies Story;
      + 
      + export const HasPlayFunctionDuplicated = {
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
            foo: "bar",
          },
        });
        
      + export const EmptyDuplicated = meta.story({});
      + export const WithArgsDuplicated = meta.story({});
      + "
    `);
  });
  test('Name Variances', async () => {
    const before = await format(await readFile(FILES.nameVariances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.nameVariances, { makeTitle });

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

    // the duplicates must not inherit the original story's `name`, while
    // nested `name` keys (parameters, argTypes) must be preserved
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        export const WithNameAs = {
          name: "As Display Name",
        } as Story;
        
      + export const WithNameDuplicated = {} satisfies Story;
      + 
      + export const WithNestedNameDuplicated = {
      +   parameters: {
      +     design: {
      +       name: "nested name that must be preserved",
      +     },
      +   },
      + 
      +   argTypes: {
      +     name: {
      +       control: "text",
      +     },
      +   },
      + } satisfies Story;
      + 
      + export const WithOnlyNameDuplicated = {} satisfies Story;
      + export const WithNameAsDuplicated = {} as Story;
      + "
    `);
  });
  test('CSF4 Name Variances', async () => {
    const before = await format(await readFile(FILES.csf4NameVariances, 'utf-8'), {
      parser: 'typescript',
    });
    const CSF = await readCsf(FILES.csf4NameVariances, { makeTitle });

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

    // the duplicate must not inherit the original story's `name`
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
            foo: "bar",
          },
        });
        
      + export const WithNameDuplicated = meta.story({});
      + "
    `);
  });
  test('String-literal and computed name keys', async () => {
    // oxfmt normalizes quoted object keys in fixture files, so these key forms
    // can only be exercised from an inline source string
    const code = `
      export default { title: 'MyComponent' };
      const name = 'dynamic';
      export const WithQuotedName = {
        'name': 'Quoted Name',
      };
      export const WithComputedName = {
        [name]: 'value',
      };
      export const WithComputedQuotedName = {
        ['name']: 'Computed Quoted Name',
      };
    `;
    const parsed = loadCsf(code, { makeTitle }).parse();

    duplicateStoryWithNewName(parsed, 'WithQuotedName', 'WithQuotedNameDuplicated');
    duplicateStoryWithNewName(parsed, 'WithComputedName', 'WithComputedNameDuplicated');
    duplicateStoryWithNewName(parsed, 'WithComputedQuotedName', 'WithComputedQuotedNameDuplicated');

    const after = await format(printCsf(parsed).code, { parser: 'typescript' });

    // quoted 'name' and computed ['name'] keys are removed (both statically the
    // name key), while the dynamic computed [name] key is preserved
    expect(after).toMatchInlineSnapshot(`
      "export default { title: "MyComponent" };
      const name = "dynamic";
      export const WithQuotedName = {
        name: "Quoted Name",
      };
      export const WithComputedName = {
        [name]: "value",
      };
      export const WithComputedQuotedName = {
        ["name"]: "Computed Quoted Name",
      };
      export const WithQuotedNameDuplicated = {};

      export const WithComputedNameDuplicated = {
        [name]: "value",
      };

      export const WithComputedQuotedNameDuplicated = {};
      "
    `);
  });
  test('Unsupported CSF Variances', async () => {
    const CSF = await readCsf(FILES.unsupportedCsfVariances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);

    for (const name of names) {
      await expect(() => duplicateStoryWithNewName(parsed, name, name + 'Duplicated')).toThrow();
    }
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
        
      + export const CastDuplicated: Story = {};
      + export const AsDuplicated = {} as Story;
      + export const SatisfiesDuplicated = {} satisfies Story;
      + export const NoneDuplicated = {};
      + "
    `);
  });
});
