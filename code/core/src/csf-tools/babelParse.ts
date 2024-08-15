import * as babelParser from '@babel/parser';
import type { ParserOptions } from '@babel/parser';
import type * as t from '@babel/types';
import * as recast from 'recast';

function parseWithFlowOrTypescript(source: string, parserOptions: babelParser.ParserOptions) {
  const flowCommentPattern = /^\s*\/\/\s*@flow/;
  const useFlowPlugin = flowCommentPattern.test(source);

  const parserPlugins: babelParser.ParserOptions['plugins'] = useFlowPlugin
    ? ['flow']
    : ['typescript'];

  // Merge the provided parserOptions with the custom parser plugins
  const mergedParserOptions = {
    ...parserOptions,
    plugins: [...(parserOptions.plugins ?? []), ...parserPlugins],
  };

  return babelParser.parse(source, mergedParserOptions);
}

export const parserOptions: ParserOptions = {
  sourceType: 'module',
  // FIXME: we should get this from the project config somehow?
  plugins: ['jsx', 'decorators-legacy', 'classProperties'],
  tokens: true,
};

export const babelParse = (code: string): t.File => {
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
  }).code;
};

export const babelParseExpression = (code: string) => {
  return babelParser.parseExpression(code, parserOptions);
};
