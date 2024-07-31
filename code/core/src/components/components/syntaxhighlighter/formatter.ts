import memoize from 'memoizerific';

import prettierHtml from 'prettier/plugins/html';
import prettier from 'prettier/standalone';
import { dedent } from 'ts-dedent';
import type { SyntaxHighlighterFormatTypes } from './syntaxhighlighter-types';

export const formatter = memoize(2)(async (type: SyntaxHighlighterFormatTypes, source: string) => {
  if (type === false) {
    return source;
  }
  if (type === 'dedent' || type === true) {
    return dedent(source);
  }

  return (
    await prettier.format(source, {
      parser: type,
      plugins: [prettierHtml],
      htmlWhitespaceSensitivity: 'ignore',
    })
  ).trim();
});
