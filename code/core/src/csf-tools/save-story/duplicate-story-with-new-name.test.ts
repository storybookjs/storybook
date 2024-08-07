/* eslint-disable no-underscore-dangle */
import { describe, test, expect } from 'vitest';
import { readCsf, printCsf } from '@storybook/core/csf-tools';

import { duplicateStoryWithNewName } from './duplicate-story-with-new-name';
import { readFile } from 'fs/promises';
import { join } from 'node:path';
import { format } from 'prettier';
import { getDiff } from './getDiff';

const makeTitle = (userTitle: string) => userTitle;

const FILES = {
  csfVariances: join(__dirname, 'mocks/csf-variances.stories.tsx'),
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
  test('Unsupported CSF Variances', async () => {
    const CSF = await readCsf(FILES.unsupportedCsfVariances, { makeTitle });

    const parsed = CSF.parse();
    const names = Object.keys(parsed._stories);

    names.forEach((name) => {
      expect(() => duplicateStoryWithNewName(parsed, name, name + 'Duplicated')).toThrow();
    });
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
