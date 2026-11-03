import {
  type ElementNode,
  type HtmlAttribute,
  type HtmlNode,
  VOID_ELEMENTS,
} from '../../html-parse.ts';
import { escapeAttribute, inlineText, quotedAttribute } from '../../snippet-values.ts';

type InlineText = { hasText: boolean; text: string };

const INLINE_LIMIT = 80;
const INDENT = '  ';
/**
 * Html laid out in 80 columns. With `holes`, the template of the same html: each `hole` node and
 * attribute prints its hole, where the layout is that of the values the html prints.
 */
export function printHtml(nodes: HtmlNode[], holes = false): string {
  const expanded = expandHoles(nodes);
  const lines = expanded
    .filter((node) => isPrintable(node) || (holes && isPlaceholder(node)))
    .map((node) => printNode(node, 0, holes));
  return (holes ? lines.filter((line) => line !== '') : lines).join('\n');
}

interface HoleTag {
  hole: string;
  /** Whether the node prints the hole; the other nodes of the value print nothing. */
  first: boolean;
  /** A value that prints nothing, which only the template shows, as its hole. */
  placeholder?: boolean;
}

const holeTags = new WeakMap<HtmlNode, HoleTag>();

// Each `hole` node as the nodes of its value, each tagged with the hole, or as an empty text when
// its value prints nothing.
const expandHoles = (nodes: HtmlNode[]): HtmlNode[] =>
  nodes.flatMap((node): HtmlNode[] => {
    if (node.kind === 'element') {
      return [{ ...node, children: expandHoles(node.children) }];
    }
    if (node.kind !== 'hole') {
      return [node];
    }
    const inner = expandHoles(node.nodes);
    const first = inner.find(isPrintable);
    if (!first) {
      const placeholder: HtmlNode = { kind: 'text', text: '' };
      holeTags.set(placeholder, { hole: node.hole, first: true, placeholder: true });
      return [placeholder];
    }
    inner.forEach((child) => holeTags.set(child, { hole: node.hole, first: child === first }));
    return inner;
  });

const isPlaceholder = (node: HtmlNode): boolean => holeTags.get(node)?.placeholder === true;

const isPrintable = (node: HtmlNode): boolean =>
  node.kind !== 'text' || collapseText(node.text) !== '';

// The holes of the values that print nothing among `children`.
const placeholderHoles = (children: HtmlNode[]): string =>
  children
    .filter(isPlaceholder)
    .map((child) => holeTags.get(child)!.hole)
    .join('');

// A hole that spans lines, such as the template of a nested template, indented where it goes.
const indentedHole = (hole: string, indent: string): string => hole.split('\n').join(`\n${indent}`);

const printNode = (node: HtmlNode, depth: number, holes: boolean): string => {
  const indent = INDENT.repeat(depth);
  const tag = holes ? holeTags.get(node) : undefined;
  if (tag) {
    const printed = node.kind === 'text' ? textHole(tag.hole, true, true) : tag.hole;
    return tag.first ? `${indent}${indentedHole(printed, indent)}` : '';
  }
  switch (node.kind) {
    case 'comment':
      return `${indent}${node.text}`;
    case 'element':
      return printElement(node, depth, holes);
    case 'malformed':
      return node.text;
    case 'rawText':
      return printRawTextElement(node, depth, holes);
    case 'text':
      return `${indent}${collapseText(node.text)}`;
    case 'hole':
      return printNode({ ...node, kind: 'text', text: '' }, depth, holes);
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};

// Every layout decision reads the values the html prints; `holes` only changes what it prints.
const printElement = (node: ElementNode, depth: number, holes: boolean): string => {
  const indent = INDENT.repeat(depth);
  const startTag = printStartTag(node, depth, holes);
  if (VOID_ELEMENTS.has(node.name.toLowerCase())) {
    return startTag;
  }
  if (node.selfClosing) {
    return `${startTag}</${node.name}>`;
  }

  const children = printableChildren(node.children);
  if (children.length === 0) {
    const content = holes ? placeholderHoles(node.children) : '';
    return node.closed ? `${startTag}${content}</${node.name}>` : `${startTag}${content}`;
  }

  const inline = inlineElementText(node, true, false)?.text;
  if (inline) {
    if (indent.length + inline.length <= INLINE_LIMIT) {
      return `${indent}${holes ? inlineElementText(node, true, true)!.text : inline}`;
    }
  }

  const body = printChildLines(node.children, depth + 1, holes).join('\n');
  return node.closed ? `${startTag}\n${body}\n${indent}</${node.name}>` : `${startTag}\n${body}`;
};

const printChildLines = (children: HtmlNode[], depth: number, holes: boolean): string[] => {
  const lines: string[] = [];
  let group: HtmlNode[] = [];
  const flushGroup = (): void => {
    if (group.length === 0) {
      return;
    }
    const inline = inlineChildrenText(group, false);
    const indent = INDENT.repeat(depth);
    if (inline && inline.hasText && indent.length + inline.text.length <= INLINE_LIMIT) {
      lines.push(`${indent}${holes ? inlineChildrenText(group, true)!.text : inline.text}`);
    } else {
      group.forEach((child) => lines.push(printNode(child, depth, holes)));
    }
    group = [];
  };

  for (const child of children) {
    // A value that prints nothing is no node of the static snippet, so it takes no part in the
    // layout; the template prints its hole among the nodes next to it.
    if (isPlaceholder(child)) {
      if (holes) {
        group.push(child);
      }
      continue;
    }
    if (child.kind === 'text' && collapseText(child.text) === '') {
      flushGroup();
      continue;
    }
    if (inlineChildText(child, false)) {
      group.push(child);
      continue;
    }
    flushGroup();
    lines.push(printNode(child, depth, holes));
  }
  flushGroup();
  return holes ? lines.filter((line) => line.trim() !== '') : lines;
};

const inlineElementText = (
  node: ElementNode,
  requireText: boolean,
  holes: boolean
): InlineText | undefined => {
  const lowerName = node.name.toLowerCase();
  if (VOID_ELEMENTS.has(lowerName)) {
    return { hasText: false, text: printCompactStartTag(node, holes) };
  }
  if (node.selfClosing) {
    return { hasText: false, text: `${printCompactStartTag(node, holes)}</${node.name}>` };
  }
  const children = printableChildren(node.children);
  if (children.length === 0) {
    const content = holes ? placeholderHoles(node.children) : '';
    const text = node.closed
      ? `${printCompactStartTag(node, holes)}${content}</${node.name}>`
      : `${printCompactStartTag(node, holes)}${content}`;
    return { hasText: false, text };
  }
  const decided = inlineChildrenText(node.children, false);
  const childrenText = holes ? inlineChildrenText(node.children, true) : decided;
  return decided === undefined || childrenText === undefined || (requireText && !decided.hasText)
    ? undefined
    : {
        hasText: decided.hasText,
        text: `${printCompactStartTag(node, holes)}${childrenText.text}</${node.name}>`,
      };
};

const inlineChildrenText = (children: HtmlNode[], holes: boolean): InlineText | undefined => {
  const parts: string[] = [];
  let hasText = false;
  // The values that print nothing are no nodes of the static snippet, so the first and the last
  // node are among the others.
  const shown = children.filter((child) => !isPlaceholder(child));
  for (const child of children) {
    const tag = holes ? holeTags.get(child) : undefined;
    if (isPlaceholder(child)) {
      if (tag) {
        parts.push(tag.hole);
      }
      continue;
    }
    const part = inlineChildText(child, false);
    if (part === undefined) {
      return undefined;
    }
    hasText ||= part.hasText;
    if (tag) {
      if (tag.first) {
        parts.push(
          child.kind === 'text'
            ? textHole(tag.hole, child === shown[0], child === shown.at(-1))
            : tag.hole
        );
      }
      continue;
    }
    if (part.text !== '') {
      parts.push(
        child.kind === 'text'
          ? inlineText(child.text, child === shown[0], child === shown.at(-1))
          : holes
            ? inlineChildText(child, true)!.text
            : part.text
      );
    }
  }
  return { hasText, text: parts.join('') };
};

const inlineChildText = (node: HtmlNode, holes: boolean): InlineText | undefined => {
  switch (node.kind) {
    case 'text':
      return collapseText(node.text) === '' ? undefined : { hasText: true, text: node.text };
    case 'element': {
      if (!isInlineChildElement(node)) {
        return undefined;
      }
      const inline = inlineElementText(node, false, holes);
      return inline ? { hasText: false, text: inline.text } : undefined;
    }
    case 'comment':
    case 'malformed':
    case 'rawText':
    case 'hole':
      return undefined;
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};

const isInlineChildElement = (node: ElementNode): boolean =>
  !VOID_ELEMENTS.has(node.name.toLowerCase()) &&
  printableChildren(node.children).every((child) => child.kind === 'text');

const printRawTextElement = (
  node: Extract<HtmlNode, { kind: 'rawText' }>,
  depth: number,
  holes: boolean
): string => {
  const startTag = printStartTag({ attributes: node.attributes, name: node.name }, depth, holes);
  return node.closed ? `${startTag}${node.text}</${node.name}>` : `${startTag}${node.text}`;
};

// An attribute the template prints on a line of its own fills to nothing with its line.
const printStartTag = (
  node: Pick<ElementNode, 'attributes' | 'name'>,
  depth: number,
  holes: boolean
): string => {
  const indent = INDENT.repeat(depth);
  const compact = printCompactStartTag(node, false);
  if (indent.length + compact.length <= INLINE_LIMIT) {
    return `${indent}${holes ? printCompactStartTag(node, true) : compact}`;
  }
  const attributes = shownAttributes(node.attributes, holes);
  if (node.attributes.every((attribute) => attribute.omitted)) {
    return `${indent}${holes ? printCompactStartTag(node, true) : `<${node.name}>`}`;
  }
  return [
    `${indent}<${node.name}`,
    ...attributes.map((attr) => `${indent}${INDENT}${printHtmlAttribute(attr, holes)}`),
    `${indent}>`,
  ].join('\n');
};

const printCompactStartTag = (
  node: Pick<ElementNode, 'attributes' | 'name'>,
  holes: boolean
): string => {
  const attrs = shownAttributes(node.attributes, holes)
    .map((attribute) => printHtmlAttribute(attribute, holes))
    .join(' ');
  const suffix = attrs ? ` ${attrs}` : '';
  return `<${node.name}${suffix}>`;
};

const shownAttributes = (attributes: HtmlAttribute[], holes: boolean): HtmlAttribute[] =>
  holes
    ? attributes.filter((attribute) => !attribute.omitted || attribute.hole !== undefined)
    : attributes.filter((attribute) => !attribute.omitted);

const printHtmlAttribute = (
  { hole, holeValue, name, value }: HtmlAttribute,
  holes: boolean
): string => {
  if (holes && hole !== undefined) {
    return hole;
  }
  if (holes && holeValue !== undefined) {
    // The text around the holes is escaped; each hole prints its value escaped by the filler.
    const escaped = holeValue
      .split(/(⟦[^⟧]*⟧)/)
      .map((part, index) => (index % 2 === 1 ? part : escapeAttribute(part)))
      .join('');
    return `${name}="${escaped}"`;
  }
  return value === undefined ? name : quotedAttribute(name, value);
};

const printableChildren = (children: HtmlNode[]): HtmlNode[] => children.filter(isPrintable);

const collapseText = (text: string): string => text.trim().replace(/\s+/g, ' ');

// A text hole with where the snippet trims the text it prints: `^` at its start, `$` at its end. The
// filler collapses the whitespace in it as a text node prints.
const textHole = (hole: string, trimStart: boolean, trimEnd: boolean): string =>
  hole.startsWith('⟦text ')
    ? `${hole.slice(0, -1)}${trimStart ? ' ^' : ''}${trimEnd ? ' $' : ''}⟧`
    : hole;
