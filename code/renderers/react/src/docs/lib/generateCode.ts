import { generate } from 'escodegen';
import { dedent } from 'ts-dedent';

const BASIC_OPTIONS = {
  format: {
    indent: {
      style: '  ',
    },
    semicolons: false,
  },
};

const COMPACT_OPTIONS = {
  ...BASIC_OPTIONS,
  format: {
    newline: '',
  },
};

const PRETTY_OPTIONS = {
  ...BASIC_OPTIONS,
};

export function generateCode(ast: any, compact = false): string {
  return generate(ast, compact ? COMPACT_OPTIONS : PRETTY_OPTIONS);
}

export function generateObjectCode(ast: any, compact = false): string {
  return !compact ? generateCode(ast) : generateCompactCode(ast);
}

export function generateArrayCode(ast: any, compact = false): string {
  return !compact ? generateMultilineArrayCode(ast) : generateCompactCode(ast);
}

function generateMultilineArrayCode(ast: any): string {
  let result = generateCode(ast);

  // escodegen add extra spacing before the closing bracket of a multiple line array with a nested object.
  // Fix it until a better solution is found.
  if (result.endsWith('  }]')) {
    result = dedent(result);
  }

  return result;
}

// escodegen indents the items of an array or object even without newlines, so the compact form
// prints them itself, separated by one space.
function generateCompactCode(ast: any): string {
  if (ast.type === 'ArrayExpression') {
    return `[${ast.elements.map(generateCompactCode).join(', ')}]`;
  }
  if (ast.type === 'ObjectExpression') {
    return `{ ${ast.properties.map(generateCompactProperty).join(', ')} }`;
  }
  return generateCode(ast, true);
}

function generateCompactProperty(property: any): string {
  if (
    property.type !== 'Property' ||
    property.kind !== 'init' ||
    property.method ||
    property.shorthand
  ) {
    return generateCode(property, true);
  }
  const key = generateCode(property.key, true);
  return `${property.computed ? `[${key}]` : key}: ${generateCompactCode(property.value)}`;
}
