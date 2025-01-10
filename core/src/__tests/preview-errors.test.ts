import { describe, expect, it } from 'vitest';

import { UnknownArgTypesError } from '../preview-errors';

describe('UnknownFlowArgTypesError', () => {
  it('should correctly handle error with convertSig', () => {
    const type = {
      name: 'signature',
      raw: "SomeType['someProperty']",
    };

    const typeError = new UnknownArgTypesError({ type, language: 'Typescript' });
    expect(typeError.message).toMatchInlineSnapshot(`
      "There was a failure when generating detailed ArgTypes in Typescript for:
      {
        "name": "signature",
        "raw": "SomeType['someProperty']"
      } 

      Storybook will fall back to use a generic type description instead.

      This type is either not supported or it is a bug in the docgen generation in Storybook.
      If you think this is a bug, please detail it as much as possible in the Github issue.

      More info: https://github.com/storybookjs/storybook/issues/26606
      "
    `);
  });
});
