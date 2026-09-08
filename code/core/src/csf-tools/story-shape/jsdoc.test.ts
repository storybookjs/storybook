import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { loadCsf } from '../CsfFile.ts';
import { extractStoryJSDocInfo } from './jsdoc.ts';

const storyStatement = (code: string) => {
  return loadCsf(code, { makeTitle: (title) => title ?? 'title' }).parse()._storyStatements['A'];
};

describe('extractStoryJSDocInfo', () => {
  it('extracts a plain JSDoc description', () => {
    expect(
      extractStoryJSDocInfo(
        storyStatement(dedent`
          export default { title: 'Button' };
          /**
           * Primary button story.
           */
          export const A = {};
        `)
      )
    ).toEqual({
      description: 'Primary button story.',
      summary: undefined,
    });
  });

  it('uses @describe over the JSDoc body', () => {
    expect(
      extractStoryJSDocInfo(
        storyStatement(dedent`
          export default { title: 'Button' };
          /**
           * Body description.
           * @describe Tag description.
           */
          export const A = {};
        `)
      )
    ).toEqual({
      description: 'Tag description.',
      summary: undefined,
    });
  });

  it('uses @desc when @describe is absent', () => {
    expect(
      extractStoryJSDocInfo(
        storyStatement(dedent`
          export default { title: 'Button' };
          /**
           * Body description.
           * @desc Short tag description.
           */
          export const A = {};
        `)
      )
    ).toEqual({
      description: 'Short tag description.',
      summary: undefined,
    });
  });

  it('extracts @summary', () => {
    expect(
      extractStoryJSDocInfo(
        storyStatement(dedent`
          export default { title: 'Button' };
          /**
           * Full story description.
           * @summary Compact summary.
           */
          export const A = {};
        `)
      )
    ).toEqual({
      description: 'Full story description.',
      summary: 'Compact summary.',
    });
  });

  it('returns undefined fields when no JSDoc is present', () => {
    expect(
      extractStoryJSDocInfo(
        storyStatement(dedent`
          export default { title: 'Button' };
          export const A = {};
        `)
      )
    ).toEqual({
      description: undefined,
      summary: undefined,
    });
  });

  it('trims surrounding whitespace from the final description', () => {
    expect(
      extractStoryJSDocInfo(
        storyStatement(dedent`
          export default { title: 'Button' };
          /**
           *
           *   Spaced description.
           *
           */
          export const A = {};
        `)
      ).description
    ).toBe('Spaced description.');
  });
});
