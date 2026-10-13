import { isOperand } from 'storybook/internal/csf-tools';
import { hasHoleBracket, hole, isHoleWord } from 'storybook/internal/docs-tools';
import { type AST, parse } from 'svelte/compiler';
import { walk } from 'zimmerframe';

type Node = { type: string; start: number; end: number; [key: string]: any };

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * The story's raw code, from `getStoryContentRawCode`, with a hole wherever it reads `args`, for
 * `fillTemplate`. It is `undefined` when the code reads its args in a way no hole stands for, such
 * as passing `args` along whole, and the raw code is shown instead.
 */
export function getStoryContentTemplate(rawCode: string): string | undefined {
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
  const edits: Array<Edit | undefined> = [];
  walk(fragment as unknown as Node, null, {
    Identifier(node, { path }) {
      if (node.name === 'args') {
        edits.push(argEdit(node, path as Node[]));
      }
    },
  });
  if (edits.length === 0 || edits.some((edit) => edit === undefined)) {
    return undefined;
  }
  return (edits as Edit[])
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, { start, end, text: hole }) => text.slice(0, start) + hole + text.slice(end),
      code
    )
    .slice(script.length);
}

// An edit for an `args` reference, or `undefined` when it is not a hole.
function argEdit(node: Node, path: Node[]): Edit | undefined {
  const [grandparent, parent] = path.slice(-2);
  if (parent?.type === 'SpreadAttribute') {
    return spreadEdit(parent, grandparent!);
  }
  const arg = parent && argName(parent, node);
  if (arg === undefined || path.some((ancestor) => ancestor.type === 'BindDirective')) {
    return undefined;
  }
  // `args?.label` reads the arg through the chain around the member.
  const chained = grandparent?.type === 'ChainExpression';
  const read = chained ? grandparent : parent!;
  const ancestors = path.slice(0, chained ? -2 : -1).reverse();
  const [tag, owner] = ancestors;
  // `args.count++` or `args.label = …` changes the arg rather than reading it.
  if (
    tag?.type === 'UpdateExpression' ||
    (tag?.type === 'AssignmentExpression' && tag.left === read)
  ) {
    return undefined;
  }
  if (tag?.type === 'ExpressionTag' && owner?.type === 'Attribute' && owner.value === tag) {
    return { start: owner.start, end: owner.end, text: hole('attr', owner.name, arg) };
  }
  if (tag?.type === 'ExpressionTag' && owner?.type === 'Fragment') {
    return { start: tag.start, end: tag.end, text: hole('text', arg) };
  }
  const kind = isOperand(read as never, ancestors as never) ? 'operand' : 'value';
  return { start: read.start, end: read.end, text: hole(kind, arg) };
}

// The arg `args.label` or `args['label']` reads.
function argName(member: Node, object: Node): string | undefined {
  if (member.type !== 'MemberExpression' || member.object !== object) {
    return undefined;
  }
  const { property, computed } = member;
  const name = computed ? property.type === 'Literal' && property.value : property.name;
  return typeof name === 'string' && isHoleWord(name) ? name : undefined;
}

// `<Button {...args}>` passes every arg but the props the element writes after it, which win: its
// attributes and bindings, its snippets and its children.
function spreadEdit(spread: Node, element: Node): Edit | undefined {
  const attributes: Node[] = element.attributes;
  const index = attributes.indexOf(spread);
  const children: Node[] = element.fragment?.nodes ?? [];
  const props = (nodes: Node[]) =>
    nodes.filter((node) => /^(Attribute|BindDirective)$/.test(node.type)).map((node) => node.name);
  if (attributes.some((node, i) => i !== index && node.type === 'SpreadAttribute')) {
    return undefined;
  }
  const words = [
    ...props(attributes.slice(0, index)).map((name) => `^${name}`),
    ...[
      ...props(attributes.slice(index + 1)),
      ...children
        .filter((node) => node.type === 'SnippetBlock')
        .map((node) => node.expression.name),
      ...(children.length > 0 ? ['children'] : []),
    ].map((name) => `-${name}`),
  ];
  return { start: spread.start, end: spread.end, text: hole('props', ...words) };
}
