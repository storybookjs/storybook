import type { types as t } from 'storybook/internal/babel';
import { isOperand } from 'storybook/internal/csf-tools';
import { hasHoleBracket, hole, holeWord } from 'storybook/internal/docs-tools';
import { type AST, parse } from 'svelte/compiler';
import { walk } from 'zimmerframe';

type Node = { type: string; start: number; end: number; [key: string]: any };

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * The story's raw code, from `getStoryContentRawCode`, with a hole wherever it reads an arg, for
 * `fillTemplate`. `args` passed along whole stays as written, as the snippet shows it. It is
 * `undefined` only for code a hole could not be found again in, and the raw code is shown instead.
 * `args` holds the node each arg is written with, which decides where its code needs parentheses;
 * see `isOperand`.
 */
export function getStoryContentTemplate(
  rawCode: string,
  args: Record<string, t.Node> = {}
): string | undefined {
  if (hasHoleBracket(rawCode)) {
    return undefined;
  }
  // Parsed as TypeScript, which markup such as `{args.label!}` may be written in.
  const script = '<script lang="ts"></script>';
  const code = script + rawCode;
  let fragment: AST.Fragment;
  try {
    fragment = parse(code, { modern: true }).fragment;
  } catch {
    return undefined;
  }
  const edits: Edit[] = [];
  walk(fragment as unknown as Node, null, {
    Identifier(node, { path }) {
      if (node.name === 'args') {
        edits.push(...argEdit(node, path as Node[], args));
      }
    },
  });
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, { start, end, text: hole }) => text.slice(0, start) + hole + text.slice(end),
      code
    )
    .slice(script.length);
}

// The edit for an `args` reference: none for a write, or for `args` read whole, which stays as written.
function argEdit(node: Node, path: Node[], args: Record<string, t.Node>): Edit[] {
  const [grandparent, parent] = path.slice(-2);
  if (parent?.type === 'SpreadAttribute') {
    return [spreadEdit(parent, grandparent!)];
  }
  const arg = parent && argName(parent, node);
  if (arg === undefined) {
    return [];
  }
  // `args?.label` reads the arg through the chain around the member.
  const chained = grandparent?.type === 'ChainExpression';
  const read = chained ? grandparent : parent!;
  const ancestors = path.slice(0, chained ? -2 : -1).reverse();
  const [tag, owner] = ancestors;
  // `args.count++`, `args.label = …` or `delete args.label` is a write, no read, and stays as written.
  if (
    tag?.type === 'UpdateExpression' ||
    (tag?.type === 'AssignmentExpression' && tag.left === read) ||
    (tag?.type === 'UnaryExpression' && tag.operator === 'delete')
  ) {
    return [];
  }
  if (tag?.type === 'ExpressionTag' && owner?.type === 'Attribute' && owner.value === tag) {
    return [{ start: owner.start, end: owner.end, text: hole('attr', owner.name, holeWord(arg)) }];
  }
  if (tag?.type === 'ExpressionTag' && owner?.type === 'Fragment') {
    return [{ start: tag.start, end: tag.end, text: hole('text', holeWord(arg)) }];
  }
  const written = Object.hasOwn(args, arg) ? args[arg] : undefined;
  const kind = isOperand(read as never, ancestors as never, written) ? 'operand' : 'value';
  return [{ start: read.start, end: read.end, text: hole(kind, holeWord(arg)) }];
}

// The arg `args.label` or `args['label']` reads.
function argName(member: Node, object: Node): string | undefined {
  if (member.type !== 'MemberExpression' || member.object !== object) {
    return undefined;
  }
  const { property, computed } = member;
  const name = computed ? property.type === 'Literal' && property.value : property.name;
  return typeof name === 'string' ? name : undefined;
}

// `<Button {...args}>` passes every arg but the props the element writes itself: its attributes and
// bindings, its snippets and its children.
function spreadEdit(spread: Node, element: Node): Edit {
  const children: Node[] = element.fragment?.nodes ?? [];
  const words = [
    ...element.attributes
      .filter((node: Node) => /^(Attribute|BindDirective)$/.test(node.type))
      .map((node: Node) => node.name),
    ...children.filter((node) => node.type === 'SnippetBlock').map((node) => node.expression.name),
    ...(children.length > 0 ? ['children'] : []),
  ].map((name) => holeWord(`-${name}`));
  return { start: spread.start, end: spread.end, text: hole('props', ...words) };
}
