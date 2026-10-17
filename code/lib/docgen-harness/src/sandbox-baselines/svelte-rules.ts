import { parse, type AST } from 'svelte/compiler';
import ts from 'typescript';

import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import { collectCurrentOrBetterViolations } from '../compare/expect-current-or-better.ts';
import { compareSnippet } from '../compare/snippets.ts';
import { parseSvelteSnippet } from '../compare/snippets-svelte.ts';
import type { Violation } from '../compare/types.ts';

import { omitNativeMocks } from './native-mock.ts';
import type { StorySource } from './capture/story-source.ts';

export type AcceptedRule =
  | 'native-mock-omitted'
  | 'text-equivalent'
  | 'snippet-child'
  | 'default-omitted'
  | 'event-omitted'
  | 'binding-represented';

const markup = (snippet: string) =>
  snippet
    .replace(/^\s*<script\b[^>]*>[\s\S]*?<\/script\s*>\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

function componentRoot(fragment: AST.Fragment): AST.Component | undefined {
  for (const node of fragment.nodes) {
    if (node.type === 'Component') return node;
    if (node.type === 'RegularElement') {
      const child = componentRoot(node.fragment);
      if (child) return child;
    }
  }
  return undefined;
}

function snippetChildren(snippet: string): Set<string> {
  try {
    const root = componentRoot(parse(snippet, { modern: true }).fragment);
    return new Set(
      root?.fragment.nodes.flatMap((node) =>
        node.type === 'SnippetBlock' ? [node.expression.name] : []
      )
    );
  } catch {
    return new Set();
  }
}

function declaredBindings(snippet: string): Set<string> {
  try {
    const ast = parse(snippet, { modern: true });
    const declarations = new Set(
      ast.instance?.content.body.flatMap((node) =>
        node.type === 'VariableDeclaration'
          ? node.declarations.flatMap((declaration) =>
              declaration.id.type === 'Identifier' && declaration.init ? [declaration.id.name] : []
            )
          : []
      )
    );
    return new Set(
      componentRoot(ast.fragment)?.attributes.flatMap((attribute) =>
        attribute.type === 'BindDirective' &&
        attribute.expression.type === 'Identifier' &&
        declarations.has(attribute.expression.name)
          ? [attribute.name]
          : []
      )
    );
  } catch {
    return new Set();
  }
}

function literalValue(text: string): { value: unknown } | undefined {
  if (text.startsWith('{') && text.endsWith('}')) text = text.slice(1, -1).trim();
  const file = ts.createSourceFile('value.ts', `(${text})`, ts.ScriptTarget.Latest, true);
  const statement = file.statements[0];
  if (file.statements.length !== 1 || !statement || !ts.isExpressionStatement(statement))
    return undefined;
  const expression = statement.expression;
  if (!ts.isParenthesizedExpression(expression) || expression.getText(file) !== `(${text})`)
    return undefined;
  const value = expression.expression;
  if (ts.isStringLiteral(value)) return { value: value.text };
  if (ts.isNumericLiteral(value)) return { value: Number(value.text) };
  if (value.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
  if (value.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
  if (value.kind === ts.SyntaxKind.NullKeyword) return { value: null };
  return undefined;
}

export function compareSvelteCaptureSnippet({
  baseline,
  candidate,
  argTypes,
  source,
  sha,
  storyId,
}: {
  baseline: string;
  candidate: string;
  argTypes: StrictArgTypes;
  source?: StorySource;
  sha?: string;
  storyId?: string;
}): { violations: Violation[]; accepted: AcceptedRule[] } {
  const accepted: AcceptedRule[] = [];
  const counted = new Set<string>();
  const before = parseSvelteSnippet(baseline);
  const after = parseSvelteSnippet(candidate);
  if (!before && !after && markup(baseline) === markup(candidate)) {
    return { violations: [], accepted: ['text-equivalent'] };
  }
  if (!before && !after) {
    const stripped = omitNativeMocks(baseline, source, sha, storyId);
    if (
      stripped !== baseline &&
      [stripped, omitNativeMocks(baseline, source, sha, storyId, true)].some(
        (text) => markup(text) === markup(candidate)
      )
    )
      return { violations: [], accepted: ['native-mock-omitted'] };
  }
  const input = { kind: 'snippet', framework: 'svelte', baseline, candidate } satisfies Parameters<
    typeof collectCurrentOrBetterViolations
  >[0];
  const violations =
    before && after ? compareSnippet(input) : collectCurrentOrBetterViolations(input);
  if (!before || !after) return { violations, accepted };
  const bindings = declaredBindings(candidate);
  const children = snippetChildren(candidate);
  return {
    accepted,
    violations: violations.filter((violation) => {
      if (violation.kind === 'lost-representation' && before.bareAttributes.has(violation.arg))
        return false;
      let rule: AcceptedRule | undefined;
      if (violation.kind === 'lost-representation' || violation.kind === 'lost-attribute') {
        const name = violation.arg;
        const entry = argTypes[name];
        const rawValue = before.values.get(name);
        const value = before.bareAttributes.has(name)
          ? { value: true }
          : rawValue === undefined
            ? undefined
            : /^[{"']/.test(rawValue)
              ? literalValue(rawValue)
              : { value: rawValue };
        const defaultValue = literalValue(entry?.table?.defaultValue?.summary ?? '');
        if (
          bindings.has(name) &&
          before.names.has(`bind:${name}`) &&
          after.names.has(`bind:${name}`) &&
          before.values.get(`bind:${name}`) === after.values.get(`bind:${name}`)
        )
          rule = 'binding-represented';
        else if (children.has(name)) rule = 'snippet-child';
        else if (defaultValue && value && Object.is(value.value, defaultValue.value)) {
          rule = 'default-omitted';
        } else if (
          entry?.type?.name === 'function' &&
          entry.table?.category === 'events' &&
          before.values.get(name)?.replace(/\s/g, '') === `{${name}}`
        ) {
          rule = 'event-omitted';
        }
      }
      if (!rule) return true;
      const key = `${rule}:${violation.arg}`;
      if (!counted.has(key)) accepted.push(rule);
      counted.add(key);
      return false;
    }),
  };
}
