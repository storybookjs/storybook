// Turns a resolved arg node into the Angular template expression a binding carries. Reading the args
// themselves - following spreads and names - is the shared CSF pass in `story-shape`.
import {
  type ESTreeNode as Node,
  textOf,
  expressionFromSource,
  staticKey,
  parseModule,
  reindent,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import type { SnippetEnum } from './build-docgen.ts';
import { isValidIdentifier } from '../template-grammar.ts';

const EVAL_FAILED = Symbol('story-docs-eval-failed');

/**
 * How a value copied out of another module has to reduce before an Angular binding can carry it.
 *
 * A binding the snippet prints names nothing outside itself, so an arg from another file may only
 * join the record once it evaluates to a value that stands on its own.
 */
export const createArgExternalizer =
  (enums: SnippetEnum[]) =>
  (node: Node): Node | undefined => {
    const value = evaluateNode(node, enums);
    return value === EVAL_FAILED
      ? undefined
      : expressionFromSource(printExpressionValue(value, new Set()));
  };

/**
 * The arg's value as a standalone expression, or `undefined` when it needs the story to run.
 *
 * Unlike {@link evaluateArgExpression} this never falls back to source text, so a caller that has
 * to produce code rather than an attribute can tell a real value from a name only the story file
 * knows. The two positions share a printer, so a value reads the same wherever it lands.
 */
export const evaluateArgLiteral = (node: Node, enums: SnippetEnum[]): string | undefined => {
  const value = evaluateNode(unwrapExpression(node), enums);
  return value === EVAL_FAILED ? undefined : printExpressionValue(value, new Set());
};

export const argFieldValue = (node: Node): string => printArgSource(textOf(unwrapExpression(node)));

// An arg no static evaluation could reduce to a value falls back to its source text, without the
// comments a template expression cannot take (a class field keeps them). Every expression is
// escaped for the attribute position it lands in: the double-quote delimiter and text Angular's
// lexer would decode as a character reference survive the round-trip unchanged.
export const evaluateArgExpression = (node: Node, enums: SnippetEnum[]): string => {
  const literal = evaluateArgLiteral(node, enums);
  return escapeAttributeExpression(
    literal ?? printArgSource(withoutComments(textOf(unwrapExpression(node))))
  );
};

// Continuation lines keep the story file's indentation, which the snippet replaces with its own.
// Lines inside template literals are values and keep theirs.
const printArgSource = (code: string): string => {
  const lines = code.split('\n').slice(1);
  const last = lines.at(-1);
  const indents = lines.filter((line) => line.trim()).map((line) => /^[ \t]*/.exec(line)![0]);
  // A closing bracket sits at the expression's own indentation; otherwise the shallowest line does.
  const indent =
    last && /^[ \t]*[)\]}]/.test(last)
      ? /^[ \t]*/.exec(last)![0]
      : indents.reduce(
          (shortest, current) => (current.length < shortest.length ? current : shortest),
          indents[0] ?? ''
        );
  let result = reindent(code, indent, '');
  // Tabs left on code lines become spaces, deepest first so each line is converted once.
  const deepest = Math.max(0, ...result.split('\n').map((line) => /^\t*/.exec(line)![0].length));
  for (let depth = deepest; depth > 0; depth--) {
    result = reindent(result, '\t'.repeat(depth), '  '.repeat(depth));
  }
  return result;
};

const withoutComments = (code: string): string => {
  const { code: wrapped, comments } = parseModule(`(${code}\n)`);
  let result = '';
  let cursor = 0;
  for (const comment of comments) {
    result += wrapped.slice(cursor, comment.start);
    cursor = comment.end + /^[ \t]*/.exec(wrapped.slice(comment.end))![0].length;
    if (wrapped[cursor] === '\n') {
      // A comment that ended its line takes the whitespace before it along.
      result = result.replace(/[ \t]+$/, '');
    } else if (/[\w$]$/.test(result) && /[\w$]/.test(wrapped[cursor])) {
      // `a/* c */instanceof B` stays two tokens.
      result += ' ';
    }
  }
  result += wrapped.slice(cursor);
  return result.slice(1, -2);
};

// Angular expression strings support backslash escapes, so quoting stays lossless.
const quoteExpressionString = (value: string): string =>
  `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;

// Renders an evaluated arg as a template expression, in the same shape the runtime generator
// prints, but losslessly for strings carrying quotes.
const printExpressionValue = (value: unknown, seen: Set<unknown>): string => {
  if (typeof value === 'string') {
    return quoteExpressionString(value);
  }
  if (typeof value !== 'object' || value === null) {
    return `${value}`;
  }
  if (seen.has(value)) {
    return quoteExpressionString('[Circular]');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((element) => printExpressionValue(element ?? null, seen)).join(', ')}]`;
  }
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(
      ([key, entryValue]) =>
        `${isValidIdentifier(key) ? key : quoteExpressionString(key)}: ${printExpressionValue(entryValue, seen)}`
    );
  return `{${entries.join(', ')}}`;
};

const escapeAttributeExpression = (expression: string): string =>
  expression.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');

const evaluateNode = (node: Node, enums: SnippetEnum[]): unknown => {
  const unwrapped = unwrapExpression(node);
  if (unwrapped.type === 'Literal') {
    const { value } = unwrapped;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return 'regex' in unwrapped || 'bigint' in unwrapped ? EVAL_FAILED : null;
  }
  if (unwrapped.type === 'Identifier' && unwrapped.name === 'undefined') {
    return undefined;
  }
  if (unwrapped.type === 'UnaryExpression' && unwrapped.operator === 'void') {
    return undefined;
  }
  if (
    unwrapped.type === 'UnaryExpression' &&
    unwrapped.operator === '-' &&
    unwrapped.argument.type === 'Literal' &&
    typeof unwrapped.argument.value === 'number'
  ) {
    return -unwrapped.argument.value;
  }
  if (unwrapped.type === 'TemplateLiteral' && unwrapped.expressions.length === 0) {
    return unwrapped.quasis[0]?.value.cooked ?? EVAL_FAILED;
  }
  if (unwrapped.type === 'ArrayExpression') {
    const values: unknown[] = [];
    for (const element of unwrapped.elements) {
      if (element === null || element.type === 'SpreadElement') {
        return EVAL_FAILED;
      }
      const value = evaluateNode(element, enums);
      if (value === EVAL_FAILED) {
        return EVAL_FAILED;
      }
      values.push(value);
    }
    return values;
  }
  if (unwrapped.type === 'ObjectExpression') {
    const value: Record<string, unknown> = {};
    for (const property of unwrapped.properties) {
      if (property.type !== 'Property' || property.method || property.kind !== 'init') {
        return EVAL_FAILED;
      }
      const key = staticKey(property);
      if (key === undefined) {
        return EVAL_FAILED;
      }
      const propertyValue = evaluateNode(property.value, enums);
      if (propertyValue === EVAL_FAILED) {
        return EVAL_FAILED;
      }
      value[key] = propertyValue;
    }
    return value;
  }
  // `Enum.Member`: the analyzer collects referenced enums, so the member's value - what the
  // runtime generator would see - is recoverable statically.
  if (
    unwrapped.type === 'MemberExpression' &&
    !unwrapped.computed &&
    unwrapped.object.type === 'Identifier' &&
    unwrapped.property.type === 'Identifier'
  ) {
    const objectName = unwrapped.object.name;
    const propertyName = unwrapped.property.name;
    const member = enums
      .find((enumeration) => enumeration.name === objectName)
      ?.members.find((candidate) => candidate.name === propertyName);
    return member?.value ?? EVAL_FAILED;
  }
  return EVAL_FAILED;
};
