import memoize from 'memoizerific';
import { dedent } from 'ts-dedent';

import type { SyntaxHighlighterFormatTypes } from './syntaxhighlighter-types';

export const formatter = memoize(2)(async (type: SyntaxHighlighterFormatTypes, source: string) => {
  if (type === false) {
    return source;
  }

  return dedent(source);
});
