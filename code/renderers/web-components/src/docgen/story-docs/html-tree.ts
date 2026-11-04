import type { HoleMarks } from 'storybook/internal/docs-tools';

import {
  type ElementNode,
  type HtmlAttribute,
  type HtmlNode,
  VOID_ELEMENTS,
} from '../../html-parse.ts';
import type { HtmlHole, HtmlHolePlace } from '../../snippet-holes.ts';
import { escapeAttribute, inlineText, quotedAttribute } from '../../snippet-values.ts';

type InlineText = { hasText: boolean; text: string };
// With marks, the printer prints the template of the html: the same html with each hole marked.
type Marks = HoleMarks<HtmlHolePlace> | undefined;

const INLINE_LIMIT = 80;
const INDENT = '  ';
// Html laid out in 80 columns. With `marks`, the template of the same html: each `hole` node and
// attribute marks what it prints as its hole. A value that prints nothing goes at the end of the
// content it stands in, and an attribute that does at the end of the start tag.
export function printHtml(nodes: HtmlNode[], marks?: HoleMarks<HtmlHolePlace>): string {
  const expanded = expandHoles(nodes);
  const lines = expanded.filter(isPrintable).map((node) => printNode(node, 0, marks));
  const html = lines.join('\n');
  return marks ? html + placeholderHoles(expanded, html ? '\n' : '', marks) : html;
}

interface HoleTag {
  hole: HtmlHole;
  // Whether the node opens the hole, and whether it closes it.
  first: boolean;
  last: boolean;
  // A value that prints nothing, which only the template shows, as its hole.
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
    const printable = inner.filter(isPrintable);
    if (printable.length === 0) {
      const placeholder: HtmlNode = { kind: 'text', text: '' };
      holeTags.set(placeholder, { hole: node.hole, first: true, last: true, placeholder: true });
      return [placeholder];
    }
    inner.forEach((child) =>
      holeTags.set(child, {
        hole: node.hole,
        first: child === printable[0],
        last: child === printable.at(-1),
      })
    );
    return inner;
  });

const isPlaceholder = (node: HtmlNode): boolean => holeTags.get(node)?.placeholder === true;

const isPrintable = (node: HtmlNode): boolean =>
  node.kind !== 'text' || collapseText(node.text) !== '';

// The holes of the values that print nothing among `children`, each after `space` once it prints.
const placeholderHoles = (children: HtmlNode[], space: string, marks: Marks): string =>
  marks
    ? children
        .filter(isPlaceholder)
        .map((child) => marks.mark(holeTags.get(child)!.hole, '', space))
        .join('')
    : '';

// `printed` with the hole of its node opened before it, after its indent, and closed after it. A
// text hole says whether the snippet trims the text it prints at its start and at its end.
const wrapInHole = (
  printed: string,
  tag: HoleTag | undefined,
  trim: { start: boolean; end: boolean },
  marks: Marks
): string => {
  if (!tag || !marks) {
    return printed;
  }
  const hole: HtmlHole =
    tag.hole.kind === 'text' ? { ...tag.hole, trimStart: trim.start, trimEnd: trim.end } : tag.hole;
  const indent = printed.match(/^\s*/)![0];
  const text = printed.slice(indent.length);
  if (tag.first && tag.last) {
    return `${indent}${marks.mark(hole, text)}`;
  }
  // A hole of several nodes is printed a node at a time: its first node opens the mark and its last
  // closes it, each with its half of the mark split around a newline, which a mark never holds.
  const [open, close] = marks.mark(hole, '\n').split('\n') as [string, string];
  return `${indent}${tag.first ? open : ''}${text}${tag.last ? close : ''}`;
};

const printNode = (node: HtmlNode, depth: number, marks: Marks): string =>
  wrapInHole(
    printNodeText(node, depth, marks),
    holeTags.get(node),
    { start: true, end: true },
    marks
  );

const printNodeText = (node: HtmlNode, depth: number, marks: Marks): string => {
  const indent = INDENT.repeat(depth);
  switch (node.kind) {
    case 'comment':
      return `${indent}${node.text}`;
    case 'element':
      return printElement(node, depth, marks);
    case 'malformed':
      return node.text;
    case 'rawText':
      return printRawTextElement(node, depth, marks);
    case 'text':
      return `${indent}${collapseText(node.text)}`;
    case 'hole':
      return '';
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};

// Every layout decision reads the values the html prints; `marks` only changes what it prints.
const printElement = (node: ElementNode, depth: number, marks: Marks): string => {
  const indent = INDENT.repeat(depth);
  const startTag = printStartTag(node, depth, marks);
  if (VOID_ELEMENTS.has(node.name.toLowerCase())) {
    return startTag;
  }
  if (node.selfClosing) {
    return `${startTag}</${node.name}>`;
  }

  const children = printableChildren(node.children);
  if (children.length === 0) {
    const content = placeholderHoles(node.children, '', marks);
    return node.closed ? `${startTag}${content}</${node.name}>` : `${startTag}${content}`;
  }

  const inline = inlineElementText(node, true, undefined)?.text;
  if (inline) {
    if (indent.length + inline.length <= INLINE_LIMIT) {
      return `${indent}${marks ? inlineElementText(node, true, marks)!.text : inline}`;
    }
  }

  const body =
    printChildLines(node.children, depth + 1, marks).join('\n') +
    placeholderHoles(node.children, `\n${INDENT.repeat(depth + 1)}`, marks);
  return node.closed ? `${startTag}\n${body}\n${indent}</${node.name}>` : `${startTag}\n${body}`;
};

const printChildLines = (children: HtmlNode[], depth: number, marks: Marks): string[] => {
  const lines: string[] = [];
  let group: HtmlNode[] = [];
  const flushGroup = (): void => {
    if (group.length === 0) {
      return;
    }
    const inline = inlineChildrenText(group, undefined);
    const indent = INDENT.repeat(depth);
    if (inline && inline.hasText && indent.length + inline.text.length <= INLINE_LIMIT) {
      lines.push(`${indent}${marks ? inlineChildrenText(group, marks)!.text : inline.text}`);
    } else {
      group.forEach((child) => lines.push(printNode(child, depth, marks)));
    }
    group = [];
  };

  for (const child of children) {
    if (isPlaceholder(child)) {
      continue;
    }
    if (child.kind === 'text' && collapseText(child.text) === '') {
      flushGroup();
      continue;
    }
    if (inlineChildText(child, undefined)) {
      group.push(child);
      continue;
    }
    flushGroup();
    lines.push(printNode(child, depth, marks));
  }
  flushGroup();
  return lines;
};

const inlineElementText = (
  node: ElementNode,
  requireText: boolean,
  marks: Marks
): InlineText | undefined => {
  const lowerName = node.name.toLowerCase();
  if (VOID_ELEMENTS.has(lowerName)) {
    return { hasText: false, text: printCompactStartTag(node, marks) };
  }
  if (node.selfClosing) {
    return { hasText: false, text: `${printCompactStartTag(node, marks)}</${node.name}>` };
  }
  const content = placeholderHoles(node.children, '', marks);
  const children = printableChildren(node.children);
  if (children.length === 0) {
    const text = node.closed
      ? `${printCompactStartTag(node, marks)}${content}</${node.name}>`
      : `${printCompactStartTag(node, marks)}${content}`;
    return { hasText: false, text };
  }
  const childrenText = inlineChildrenText(node.children, marks);
  return childrenText === undefined || (requireText && !childrenText.hasText)
    ? undefined
    : {
        hasText: childrenText.hasText,
        text: `${printCompactStartTag(node, marks)}${childrenText.text}${content}</${node.name}>`,
      };
};

const inlineChildrenText = (children: HtmlNode[], marks: Marks): InlineText | undefined => {
  const parts: string[] = [];
  let hasText = false;
  const shown = children.filter((child) => !isPlaceholder(child));
  for (const child of shown) {
    const part = inlineChildText(child, marks);
    if (part === undefined) {
      return undefined;
    }
    hasText ||= part.hasText;
    const trim = { start: child === shown[0], end: child === shown.at(-1) };
    const text = child.kind === 'text' ? inlineText(child.text, trim.start, trim.end) : part.text;
    if (text !== '') {
      parts.push(wrapInHole(text, holeTags.get(child), trim, marks));
    }
  }
  return { hasText, text: parts.join('') };
};

const inlineChildText = (node: HtmlNode, marks: Marks): InlineText | undefined => {
  switch (node.kind) {
    case 'text':
      return collapseText(node.text) === '' ? undefined : { hasText: true, text: node.text };
    case 'element': {
      if (!isInlineChildElement(node)) {
        return undefined;
      }
      const inline = inlineElementText(node, false, marks);
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
  marks: Marks
): string => {
  const startTag = printStartTag({ attributes: node.attributes, name: node.name }, depth, marks);
  return node.closed ? `${startTag}${node.text}</${node.name}>` : `${startTag}${node.text}`;
};

const printStartTag = (
  node: Pick<ElementNode, 'attributes' | 'name'>,
  depth: number,
  marks: Marks
): string => {
  const indent = INDENT.repeat(depth);
  const compact = printCompactStartTag(node, undefined);
  if (indent.length + compact.length <= INLINE_LIMIT || shown(node.attributes).length === 0) {
    return `${indent}${marks ? printCompactStartTag(node, marks) : compact}`;
  }
  const lines = shown(node.attributes).map(
    (attribute) => `${indent}${INDENT}${printHtmlAttribute(attribute, marks)}`
  );
  const omitted = omittedHoles(node.attributes, `\n${indent}${INDENT}`, marks);
  return [
    `${indent}<${node.name}`,
    ...lines.slice(0, -1),
    lines.at(-1) + omitted,
    `${indent}>`,
  ].join('\n');
};

const printCompactStartTag = (
  node: Pick<ElementNode, 'attributes' | 'name'>,
  marks: Marks
): string => {
  const attrs = shown(node.attributes)
    .map((attribute) => printHtmlAttribute(attribute, marks))
    .join(' ');
  const omitted = omittedHoles(node.attributes, ' ', marks);
  return `<${node.name}${attrs ? ` ${attrs}` : ''}${omitted}>`;
};

const shown = (attributes: HtmlAttribute[]): HtmlAttribute[] =>
  attributes.filter((attribute) => !attribute.omitted);

// The holes of the attributes that print nothing, each after `space` once it prints.
const omittedHoles = (attributes: HtmlAttribute[], space: string, marks: Marks): string =>
  marks
    ? attributes
        .flatMap((attribute) => (attribute.omitted && attribute.hole ? [attribute.hole] : []))
        .map((hole) => marks.mark(hole, '', space))
        .join('')
    : '';

const printHtmlAttribute = (attribute: HtmlAttribute, marks: Marks): string => {
  const { hole, holeValue, name, value } = attribute;
  if (marks && holeValue !== undefined) {
    // The text of each hole is escaped as the rest of the value is.
    const marked = holeValue
      .map((segment) => {
        if (typeof segment === 'string') {
          return escapeAttribute(segment);
        }
        const { text, space, ...ref } = segment;
        return marks.mark(ref, escapeAttribute(text), space);
      })
      .join('');
    return `${name}="${marked}"`;
  }
  const printed = value === undefined ? name : quotedAttribute(name, value);
  return marks && hole ? marks.mark(hole, printed) : printed;
};

const printableChildren = (children: HtmlNode[]): HtmlNode[] => children.filter(isPrintable);

const collapseText = (text: string): string => text.trim().replace(/\s+/g, ' ');
