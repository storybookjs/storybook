import { babelParse, traverse, types as t } from 'storybook/internal/babel';
import { isEqual } from 'es-toolkit/compat';
import { parse } from 'svelte/compiler';
import { walk } from 'zimmerframe';

import type { SvelteAST } from '../../svelte-csf/parser/ast.ts';
import { argsToProps, valueToString } from './print/svelte-props.ts';

export function printTemplate({
  code,
  args,
  expressions,
  omitDefaults,
}: {
  code: string;
  args: Record<string, unknown>;
  expressions: Record<string, string>;
  omitDefaults: Record<string, unknown>;
}): string {
  const ast = parse(code, { modern: true });
  const edits: { start: number; end: number; value: string }[] = [];
  const argNames = new Set([...Object.keys(args), ...Object.keys(expressions)]);
  const printValue = (value: unknown) =>
    value === null ? 'null' : (valueToString(value) ?? 'undefined');
  const printProp = (key: string) =>
    key in expressions
      ? `${key}={${expressions[key]}}`
      : typeof args[key] === 'string' && /[{}<>"\\&\r\n\t]/.test(args[key])
        ? `${key}={${JSON.stringify(args[key])}}`
        : argsToProps(key, args[key]);
  const staticPath = (node: t.Node): string[] | undefined => {
    if (t.isIdentifier(node, { name: 'args' })) return [];
    if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) return;
    const parent = staticPath(node.object);
    const key =
      !node.computed && t.isIdentifier(node.property)
        ? node.property.name
        : t.isStringLiteral(node.property) || t.isNumericLiteral(node.property)
          ? String(node.property.value)
          : undefined;
    return parent && key !== undefined ? [...parent, key] : undefined;
  };
  const position = (node: object) => {
    if (
      !('start' in node) ||
      typeof node.start !== 'number' ||
      !('end' in node) ||
      typeof node.end !== 'number'
    )
      throw new TypeError('Parsed expression has no source range');
    return { start: node.start, end: node.end };
  };
  const escapeAttribute = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const replaceExpression = (expressionCode: string) => {
    const parsed = babelParse(`(${expressionCode})`);
    const replacements: { start: number; end: number; value: string; raw?: unknown }[] = [];
    traverse(parsed, {
      'MemberExpression|OptionalMemberExpression'(reference) {
        const keys = staticPath(reference.node);
        if (!keys?.length || reference.scope.hasBinding('args')) return;
        const key = keys[0];
        let value: unknown = args[key];
        let printed: string;
        if (key in expressions) {
          printed = `(${expressions[key]})${keys
            .slice(1)
            .map((part) =>
              /^[A-Za-z_$][\w$]*$/.test(part) ? `.${part}` : `[${JSON.stringify(part)}]`
            )
            .join('')}`;
        } else {
          for (const part of keys.slice(1))
            value = value != null ? Reflect.get(Object(value), part) : undefined;
          printed = printValue(value);
        }
        replacements.push({
          start: position(reference.node).start - 1,
          end: position(reference.node).end - 1,
          value: printed,
          ...(!(key in expressions) ? { raw: value } : {}),
        });
        reference.skip();
      },
    });
    let value = expressionCode;
    for (const replacement of replacements.sort((a, b) => b.start - a.start))
      value = value.slice(0, replacement.start) + replacement.value + value.slice(replacement.end);
    return { value, replacements };
  };
  const shadowsArgs = (path: SvelteAST.SvelteNode[]) =>
    path.some((ancestor) => {
      const patterns =
        ancestor.type === 'SnippetBlock'
          ? ancestor.parameters
          : ancestor.type === 'EachBlock' && path.some((node) => Object.is(node, ancestor.body))
            ? [ancestor.context]
            : ancestor.type === 'Fragment'
              ? ancestor.nodes.flatMap((child) =>
                  child.type === 'ConstTag'
                    ? child.declaration.declarations.map((declaration) => declaration.id)
                    : []
                )
              : [];
      return patterns.some((pattern) => {
        if (!pattern) return false;
        const range = position(pattern);
        const parsed = babelParse(`(${code.slice(range.start, range.end)}) => {}`);
        const statement = parsed.program.body[0];
        return (
          t.isExpressionStatement(statement) &&
          t.isArrowFunctionExpression(statement.expression) &&
          statement.expression.params.some(
            (parameter) => 'args' in t.getBindingIdentifiers(parameter)
          )
        );
      });
    });
  let usesChildren = false;
  walk<SvelteAST.SvelteNode, null>(ast.fragment, null, {
    MemberExpression(node, { path, next }) {
      if (
        !shadowsArgs(path) &&
        node.object.type === 'Identifier' &&
        node.object.name === 'args' &&
        ((node.property.type === 'Identifier' && node.property.name === 'children') ||
          (node.property.type === 'Literal' && node.property.value === 'children'))
      )
        usesChildren = true;
      next();
    },
  });
  const visitedExpressions = new Set<object>();
  walk<SvelteAST.SvelteNode, null>(ast.fragment, null, {
    Identifier(node, { path }) {
      if (
        node.name !== 'args' ||
        path.some((ancestor) => ancestor.type === 'ExpressionTag') ||
        shadowsArgs(path)
      )
        return;
      const expression = path.find((ancestor) => /Expression$/.test(ancestor.type));
      if (!expression || visitedExpressions.has(expression)) return;
      visitedExpressions.add(expression);
      const range = position(expression);
      const { value, replacements } = replaceExpression(code.slice(range.start, range.end));
      if (replacements.length) edits.push({ ...range, value });
    },
    Attribute(node, { path, next }) {
      const parent = path.at(-1);
      if (
        parent &&
        'attributes' in parent &&
        argNames.has(node.name) &&
        parent.attributes.some(
          (attribute: SvelteAST.Component['attributes'][number]) =>
            attribute.type === 'SpreadAttribute' &&
            attribute.start > node.start &&
            attribute.expression.type === 'Identifier' &&
            attribute.expression.name === 'args'
        )
      ) {
        edits.push({
          start: node.start,
          end: node.end,
          value: `${node.name}={${node.name in expressions ? `(${expressions[node.name]})` : printValue(args[node.name])}}`,
        });
        return;
      }
      next();
    },
    SpreadAttribute(node, { path, next }) {
      if (
        shadowsArgs(path) ||
        node.expression.type !== 'Identifier' ||
        node.expression.name !== 'args'
      ) {
        next();
        return;
      }
      const parent = path.at(-1);
      const omitted = new Set(
        parent && 'attributes' in parent
          ? parent.attributes.flatMap((attribute: SvelteAST.Component['attributes'][number]) =>
              attribute.type === 'Attribute' || attribute.type === 'BindDirective'
                ? [attribute.name]
                : []
            )
          : []
      );
      const props = [...argNames]
        .filter(
          (key) =>
            !omitted.has(key) &&
            !(key === 'children' && usesChildren) &&
            (key in expressions || !(key in omitDefaults) || !isEqual(args[key], omitDefaults[key]))
        )
        .map(printProp)
        .filter((value) => value !== null);
      const value = props.join(' ').length > 50 ? `\n  ${props.join('\n  ')}\n` : props.join(' ');
      let start = node.start;
      let end = node.end;
      if (value.startsWith('\n')) while (start > 0 && /[ \t]/.test(code[start - 1])) start--;
      if (!value) {
        const lineStart = code.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = code.indexOf('\n', end);
        if (
          lineEnd !== -1 &&
          !code.slice(lineStart, start).trim() &&
          !code.slice(end, lineEnd).trim()
        ) {
          start = lineStart;
          end = lineEnd + 1;
        } else if (code[start - 1] === ' ') start--;
      }
      edits.push({ start, end, value });
    },
    ExpressionTag(node, { path }) {
      const range = position(node.expression);
      const expressionCode = code.slice(range.start, range.end);
      if (shadowsArgs(path)) return;
      const { value, replacements } = replaceExpression(expressionCode);
      if (!replacements.length) return;
      const parent = path.at(-1);
      const quoted =
        parent?.type === 'Attribute' &&
        (code.slice(parent.start, node.start).includes('="') ||
          code.slice(parent.start, node.start).includes("='"));
      const only = replacements.length === 1 ? replacements[0] : undefined;
      if (
        only &&
        only.start === 0 &&
        only.end === expressionCode.length &&
        typeof only.raw === 'string' &&
        (quoted || (parent?.type === 'Fragment' && !/[{}<>"\\&]/.test(only.raw)))
      ) {
        edits.push({
          start: node.start,
          end: node.end,
          value: quoted ? escapeAttribute(only.raw) : only.raw,
        });
      } else edits.push({ ...range, value });
    },
  });
  for (const edit of edits.sort((a, b) => b.start - a.start))
    code = code.slice(0, edit.start) + edit.value + code.slice(edit.end);
  return code;
}
