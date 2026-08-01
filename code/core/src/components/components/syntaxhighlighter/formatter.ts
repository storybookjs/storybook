import memoize from 'memoizerific';
import { dedent } from 'ts-dedent';

import type { SyntaxHighlighterFormatTypes } from './syntaxhighlighter-types.ts';

export const formatter = memoize(2)(async (
  type: SyntaxHighlighterFormatTypes,
  source: string
): Promise<string> => {
  if (type === false) {
    return source;
  }

  return dedent(source);
});
