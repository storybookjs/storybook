import * as parser from '@babel/parser';
import type { ParserOptions } from '@babel/parser';
import type * as t from '@babel/types';
import { parse as hermesParse } from 'hermes-parser';
import * as recast from 'recast';

const flowCommentPattern = /^\s*\/\/\s*@flow/;

function isFlow(source: string) {
  return flowCommentPattern.test(source);
}

function parseWithFlowOrTypescript(source: string, parserOptions: parser.ParserOptions) {
  const parserPlugins: parser.ParserOptions['plugins'] = isFlow(source) ? ['flow'] : ['typescript'];

  // Merge the provided parserOptions with the custom parser plugins
  const mergedParserOptions = {
    ...parserOptions,
    plugins: [...(parserOptions.plugins ?? []), ...parserPlugins],
  };

  return parser.parse(source, mergedParserOptions);
}

export const parserOptions: ParserOptions = {
  sourceType: 'module',
  // FIXME: we should get this from the project config somehow?
  plugins: ['jsx', 'decorators-legacy', 'classProperties'],
  tokens: true,
};

export const babelParse = (code: string): t.File => {
  // @babel/parser's `flow` plugin predates modern Flow syntax (`as` casts, `readonly` variance,
  // `component` syntax, ...), so Flow sources are parsed with hermes-parser instead. Its Babel-AST
  // mode is recast-incompatible (recast mis-tokenises the output), so those files skip recast and
  // lose format preservation in babelPrint.
  if (isFlow(code)) {
    return hermesParse(code, {
      babel: true,
      flow: 'all',
      sourceType: parserOptions.sourceType === 'script' ? 'script' : 'module',
      tokens: true,
    });
  }
  return recast.parse(code, {
    parser: {
      parse(source: string) {
        return parseWithFlowOrTypescript(source, parserOptions);
      },
    },
  });
};

interface ASTNode {
  type: string;
}

export const babelPrint = (ast: ASTNode): string => {
  return recast.print(ast, {
    quote: 'single',
    trailingComma: true,
    tabWidth: 2,
    wrapColumn: 80,
    arrowParensAlways: true,
    // Recast defaults this to `os.EOL`, which would carriage-return printed snippets on Windows.
    lineTerminator: '\n',
  }).code;
};

export const babelParseExpression = (code: string): parser.ParseResult<t.Expression> => {
  return parser.parseExpression(code, parserOptions);
};
