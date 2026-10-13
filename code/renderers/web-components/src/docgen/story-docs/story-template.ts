import { types as t } from 'storybook/internal/babel';
import { hasHoleBracket, hole, isHoleWord } from 'storybook/internal/docs-tools';
import type { StrictArgTypes } from 'storybook/internal/types';

import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import { classifyArg } from './classify-args.ts';
import type { HtmlTemplate, TemplateScope } from './template-scope.ts';
import { argReferenceForExpression } from './template-scope.ts';

/**
 * `<tag⟦props …⟧></tag>` for a story without a render function, with a `binding=arg` word per arg
 * the component declares as an attribute, `.property` or `--custom-property`, the story's own first.
 */
export function argsTemplate(
  tag: string,
  storyArgs: string[],
  argTypes: StrictArgTypes,
  declaration: ManifestDeclaration
): string | undefined {
  const words = new Map<string, string>();
  for (const arg of new Set([...storyArgs, ...Object.keys(argTypes)])) {
    const { kind, ...rest } = classifyArg(arg, false, argTypes, declaration);
    const name = 'name' in rest ? rest.name : '';
    const binding =
      kind === 'property' ? `.${name}` : kind === 'attribute' || /^--/.test(name) ? name : '';
    // A field and its attribute are both args; the first one sets the attribute.
    if (binding && !words.has(binding)) {
      words.set(binding, `${binding}=${arg}`);
    }
  }
  return [...words.values()].every(isHoleWord)
    ? `<${tag}${hole('props', ...words.values())}></${tag}>`
    : undefined;
}

/**
 * The html a render function returns as written, with a hole wherever it reads an arg, or
 * `undefined` when it reads the args another way, such as passing them along whole.
 */
export function litTemplate(
  { lit, quasis, expressions, scope }: HtmlTemplate,
  param: t.Node | undefined,
  code: string
): string | undefined {
  if (!lit || hasHoleBracket(code)) {
    return undefined;
  }
  // The names that hold args, which an expression may only read as one arg.
  const names = new Set([
    ...Object.keys(param ? t.getBindingIdentifiers(param) : {}),
    ...scope.aliases.keys(),
  ]);
  let text = quasis[0]!;
  for (const [index, expression] of expressions.entries()) {
    let next = quasis[index + 1]!;
    const value = valueText(expression, scope, names, code);
    if (value === undefined) {
      return undefined;
    }
    const arg = argName(expression, scope);
    const before = quasis.slice(0, index + 1).join('');
    const inTag = before.lastIndexOf('<') > before.lastIndexOf('>');
    // `name=${…}` or `name="${…}"`, written after the tag name or the attribute before it.
    const binding = /\s+([?@]?)([^\s"'<>/=.?@][^\s"'<>/=]*)=("?)$/.exec(quasis[index]!);
    // An event binding that reads an arg passes a listener, which the snippet leaves out.
    const listener = binding?.[1] === '@' && hasHoleBracket(value);
    if (inTag && binding && next.startsWith(binding[3]!) && (arg || listener)) {
      const [whole, prefix, name, quote] = binding;
      text = text.slice(0, -whole.length);
      next = next.slice(quote!.length);
      if (!listener) {
        text += hole(prefix === '?' ? 'bool' : 'attr', name!, arg!);
      }
    } else if (arg && !inTag) {
      text += hole('text', arg);
    } else {
      text += `\${${value}}`;
    }
    text += next;
  }
  // The code has no hole bracket, so a bracket in the text is a hole written for an arg.
  return hasHoleBracket(text) ? dedent(text.trim()) : undefined;
}

// The expression as written with `⟦value arg⟧` for each arg it reads, or `undefined` when it reads
// one in a way no hole stands for.
function valueText(
  expression: t.Expression,
  scope: TemplateScope,
  names: Set<string>,
  code: string
): string | undefined {
  const edits: { start: number; end: number; arg: string }[] = [];
  const visit = (node: t.Node): boolean => {
    const arg = t.isExpression(node) ? argName(node, scope) : undefined;
    if (arg !== undefined) {
      edits.push({ start: node.start!, end: node.end!, arg });
      return isHoleWord(arg);
    }
    if (
      (t.isIdentifier(node) && names.has(node.name)) ||
      (t.isObjectProperty(node) && node.shorthand && bindsName(node.value, names)) ||
      (t.isFunction(node) && node.params.some((param) => bindsName(param, names)))
    ) {
      return false;
    }
    return t.VISITOR_KEYS[node.type]!.every((key) => {
      const named = !('computed' in node && node.computed) && ['property', 'key'].includes(key);
      const child = (node as unknown as Record<string, unknown>)[key];
      return named || [child].flat().every((item) => !t.isNode(item) || visit(item));
    });
  };
  if (!visit(expression)) {
    return undefined;
  }
  let text = code.slice(expression.start!, expression.end!);
  for (const { start, end, arg } of edits.sort((a, b) => b.start - a.start)) {
    const offset = expression.start!;
    text = text.slice(0, start - offset) + hole('value', arg) + text.slice(end - offset);
  }
  return text;
}

// The arg `args.label`, a destructured `label` or an alias of it reads.
function argName(expression: t.Expression, scope: TemplateScope): string | undefined {
  const reference = argReferenceForExpression(expression, scope);
  return reference?.path.length === 0 ? reference.name : undefined;
}

const bindsName = (param: t.Node, names: Set<string>) =>
  Object.keys(t.getBindingIdentifiers(param)).some((name) => names.has(name));

// Without the indentation the html has in the story file, which its lines after the first share.
function dedent(text: string): string {
  const [first, ...rest] = text.split('\n');
  const indents = rest.filter((line) => line.trim()).map((line) => /^\s*/.exec(line)![0].length);
  const indent = Math.min(...indents);
  return [first, ...rest.map((line) => line.slice(indent))].join('\n');
}
