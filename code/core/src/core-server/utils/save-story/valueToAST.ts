import * as t from '@babel/types';
import * as babylon from '@babel/parser';

export function valueToAST<T>(literal: T): any {
  if (literal === null) {
    return t.nullLiteral();
  }
  switch (typeof literal) {
    case 'function':
      const ast = babylon.parse(literal.toString(), {
        allowReturnOutsideFunction: true,
        allowSuperOutsideMethod: true,
      });

      // @ts-expect-error (it's the contents of the function, it's an expression, trust me)
      return ast.program.body[0]?.expression;

    case 'number':
      return t.numericLiteral(literal);
    case 'string':
      return t.stringLiteral(literal);
    case 'boolean':
      return t.booleanLiteral(literal);
    case 'undefined':
      return t.identifier('undefined');
    default:
      if (Array.isArray(literal)) {
        return t.arrayExpression(literal.map(valueToAST));
      }
      return t.objectExpression(
        Object.keys(literal)
          .filter((k) => {
            // @ts-expect-error (it's a completely unknown object)
            const value = literal[k];
            return typeof value !== 'undefined';
          })
          .map((k) => {
            // @ts-expect-error (it's a completely unknown object)
            const value = literal[k];
            return t.objectProperty(t.stringLiteral(k), valueToAST(value));
          })
      );
  }
}
