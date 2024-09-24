import { babelParse, generate, types as t, traverse } from '@storybook/core/babel';

import { dedent } from 'ts-dedent';

import { findVarInitialization } from './findVarInitialization';

const logger = console;

const getValue = (obj: t.ObjectExpression, key: string) => {
  let value: t.Expression | undefined;
  (obj.properties as t.ObjectProperty[]).forEach((p) => {
    if (t.isIdentifier(p.key) && p.key.name === key) {
      value = p.value as t.Expression;
    }
  });
  return value;
};

const parseValue = (value: t.Expression): any => {
  const expr = stripTSModifiers(value);

  if (t.isArrayExpression(expr)) {
    return (expr.elements as t.Expression[]).map((o) => {
      return parseValue(o);
    });
  }
  if (t.isObjectExpression(expr)) {
    return (expr.properties as t.ObjectProperty[]).reduce((acc, p) => {
      if (t.isIdentifier(p.key)) {
        acc[p.key.name] = parseValue(p.value as t.Expression);
      }
      return acc;
    }, {} as any);
  }
  if (t.isLiteral(expr)) {
    // @ts-expect-error (Converted from ts-ignore)
    return expr.value;
  }
  if (t.isIdentifier(expr)) {
    return unsupported(expr.name, true);
  }
  throw new Error(`Unknown node type ${expr.type}`);
};

const unsupported = (unexpectedVar: string, isError: boolean) => {
  const message = dedent`
    Unexpected '${unexpectedVar}'. Parameter 'options.storySort' should be defined inline e.g.:

    export default {
      parameters: {
        options: {
          storySort: <array | object | function>
        },
      },
    };
  `;
  if (isError) {
    throw new Error(message);
  } else {
    logger.info(message);
  }
};

const stripTSModifiers = (expr: t.Expression): t.Expression =>
  t.isTSAsExpression(expr) || t.isTSSatisfiesExpression(expr) ? expr.expression : expr;

const parseParameters = (params: t.Expression): t.Expression | undefined => {
  const paramsObject = stripTSModifiers(params);
  if (t.isObjectExpression(paramsObject)) {
    const options = getValue(paramsObject, 'options');
    if (options) {
      if (t.isObjectExpression(options)) {
        return getValue(options, 'storySort');
      }
      unsupported('options', true);
    }
  }
  return undefined;
};

const parseDefault = (defaultExpr: t.Expression, program: t.Program): t.Expression | undefined => {
  const defaultObj = stripTSModifiers(defaultExpr);
  if (t.isObjectExpression(defaultObj)) {
    let params = getValue(defaultObj, 'parameters');
    if (t.isIdentifier(params)) {
      params = findVarInitialization(params.name, program);
    }
    if (params) {
      return parseParameters(params);
    }
  } else {
    unsupported('default', true);
  }
  return undefined;
};

export const getStorySortParameter = (previewCode: string) => {
  // don't even try to process the file
  if (!previewCode.includes('storySort')) {
    return undefined;
  }

  let storySort: t.Expression | undefined;
  const ast = babelParse(previewCode);
  traverse(ast, {
    ExportNamedDeclaration: {
      enter({ node }) {
        if (t.isVariableDeclaration(node.declaration)) {
          node.declaration.declarations.forEach((decl) => {
            if (t.isVariableDeclarator(decl) && t.isIdentifier(decl.id)) {
              const { name: exportName } = decl.id;
              if (exportName === 'parameters' && decl.init) {
                const paramsObject = stripTSModifiers(decl.init);
                storySort = parseParameters(paramsObject);
              }
            }
          });
        } else {
          node.specifiers.forEach((spec) => {
            if (t.isIdentifier(spec.exported) && spec.exported.name === 'parameters') {
              unsupported('parameters', false);
            }
          });
        }
      },
    },
    ExportDefaultDeclaration: {
      enter({ node }) {
        let defaultObj = node.declaration as t.Expression;
        if (t.isIdentifier(defaultObj)) {
          defaultObj = findVarInitialization(defaultObj.name, ast.program);
        }
        defaultObj = stripTSModifiers(defaultObj);
        if (t.isObjectExpression(defaultObj)) {
          storySort = parseDefault(defaultObj, ast.program);
        } else {
          unsupported('default', false);
        }
      },
    },
  });

  if (!storySort) {
    return undefined;
  }

  if (t.isArrowFunctionExpression(storySort)) {
    const { code: sortCode } = generate(storySort, {});

    return (0, eval)(sortCode);
  }

  if (t.isFunctionExpression(storySort)) {
    const { code: sortCode } = generate(storySort, {});
    const functionName = storySort.id?.name;
    // Wrap the function within an arrow function, call it, and return
    const wrapper = `(a, b) => {
      ${sortCode};
      return ${functionName}(a, b)
    }`;

    return (0, eval)(wrapper);
  }

  if (t.isLiteral(storySort) || t.isArrayExpression(storySort) || t.isObjectExpression(storySort)) {
    return parseValue(storySort);
  }

  return unsupported('storySort', true);
};
