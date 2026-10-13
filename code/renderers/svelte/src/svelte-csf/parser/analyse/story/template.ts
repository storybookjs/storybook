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
  let fragment: AST.Fragment;
  try {
    fragment = parse(rawCode, { modern: true }).fragment;
  } catch {
    return undefined;
  }
  const edits: Array<Edit | undefined> = [];
  walk(fragment as unknown as Node, null, {
    Identifier(node, { path }) {
      if (node.name === 'args') {
        edits.push(argEdit(node, path as Node[], rawCode));
      }
    },
  });
  if (edits.length === 0 || edits.some((edit) => edit === undefined)) {
    return undefined;
  }
  return (edits as Edit[])
    .sort((a, b) => b.start - a.start)
    .reduce((code, { start, end, text }) => code.slice(0, start) + text + code.slice(end), rawCode);
}

// An edit for an `args` reference, or `undefined` when it is not a hole.
function argEdit(node: Node, path: Node[], code: string): Edit | undefined {
  const [grandparent, parent] = path.slice(-2);
  if (parent?.type === 'SpreadAttribute') {
    return spreadEdit(parent, grandparent!, code);
  }
  const arg = parent && argName(parent, node);
  // `bind:value={args.value}`, `args.count++` or `args.label = …` changes the arg too.
  const writes =
    path.some((ancestor) => ancestor.type === 'BindDirective') ||
    grandparent?.type === 'UpdateExpression' ||
    (grandparent?.type === 'AssignmentExpression' && grandparent.left === parent);
  if (arg === undefined || writes) {
    return undefined;
  }
  // `args?.label` reads the arg through the chain around the member.
  const chained = grandparent?.type === 'ChainExpression';
  const read = chained ? grandparent : parent!;
  const [owner, tag] = path.slice(0, chained ? -2 : -1).slice(-2);
  if (tag?.type === 'ExpressionTag' && owner?.type === 'Attribute' && owner.value === tag) {
    return { start: startOf(owner, code), end: owner.end, text: hole('attr', owner.name, arg) };
  }
  if (tag?.type === 'ExpressionTag' && owner?.type === 'Fragment') {
    return { start: tag.start, end: tag.end, text: hole('text', arg) };
  }
  return { start: read.start, end: read.end, text: hole('value', arg) };
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

// `<Button {...args}>` passes every arg but the props the element writes itself: its other
// attributes and bindings, its snippets and its children. Written twice, Svelte would not compile.
function spreadEdit(spread: Node, element: Node, code: string): Edit | undefined {
  const others = (element.attributes as Node[]).filter((attribute) => attribute !== spread);
  const children: Node[] = element.fragment?.nodes ?? [];
  const written = [
    ...others.filter((node) => /^(Attribute|BindDirective)$/.test(node.type)).map((n) => n.name),
    ...children.filter((node) => node.type === 'SnippetBlock').map((node) => node.expression.name),
    ...(children.length > 0 ? ['children'] : []),
  ];
  const words = written.map((name) => `-${name}`);
  return { start: startOf(spread, code), end: spread.end, text: hole('props', ...words) };
}

// Where a node starts, with the whitespace before it, as an attribute hole prints its own space.
const startOf = (node: Node, code: string) => code.slice(0, node.start).trimEnd().length;
