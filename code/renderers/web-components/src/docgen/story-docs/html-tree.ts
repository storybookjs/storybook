import { type TemplateHole, hole } from 'storybook/internal/docs-tools';

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
 * attribute wraps what it prints in its hole. A value that prints nothing goes at the end of the
 * content it stands in, and an attribute that does at the end of the start tag.
 */
export function printHtml(nodes: HtmlNode[], holes = false): string {
  const expanded = expandHoles(nodes);
  const lines = expanded.filter(isPrintable).map((node) => printNode(node, 0, holes));
  const html = lines.join('\n');
  return holes ? html + placeholderHoles(expanded, html ? '\n' : '') : html;
}

interface HoleTag {
  hole: TemplateHole;
  /** Whether the node opens the hole, and whether it closes it. */
  first: boolean;
  last: boolean;
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
const placeholderHoles = (children: HtmlNode[], space: string): string =>
  children
    .filter(isPlaceholder)
    .map((child) => hole(holeTags.get(child)!.hole, '', space))
    .join('');

// `printed` with the hole of its node opened before it, after its indent, and closed after it. A
// text hole says where the snippet trims the text it prints: `^` at its start, `$` at its end.
const wrapInHole = (
  printed: string,
  tag: HoleTag | undefined,
  trim: { start: boolean; end: boolean }
): string => {
  if (!tag) {
    return printed;
  }
  const place =
    tag.hole.kind === 'text'
      ? {
          ...tag.hole,
          words: [...tag.hole.words, ...(trim.start ? ['^'] : []), ...(trim.end ? ['$'] : [])],
        }
      : tag.hole;
  const [open] = hole(place, '').split('⟫');
  const indent = printed.match(/^\s*/)![0];
  return `${indent}${tag.first ? `${open}⟫` : ''}${printed.slice(indent.length)}${tag.last ? '⟧' : ''}`;
};

const printNode = (node: HtmlNode, depth: number, holes: boolean): string =>
  wrapInHole(printNodeText(node, depth, holes), holes ? holeTags.get(node) : undefined, {
    start: true,
    end: true,
  });

const printNodeText = (node: HtmlNode, depth: number, holes: boolean): string => {
  const indent = INDENT.repeat(depth);
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
      return '';
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
    const content = holes ? placeholderHoles(node.children, '') : '';
    return node.closed ? `${startTag}${content}</${node.name}>` : `${startTag}${content}`;
  }

  const inline = inlineElementText(node, true, false)?.text;
  if (inline) {
    if (indent.length + inline.length <= INLINE_LIMIT) {
      return `${indent}${holes ? inlineElementText(node, true, true)!.text : inline}`;
    }
  }

  const body =
    printChildLines(node.children, depth + 1, holes).join('\n') +
    (holes ? placeholderHoles(node.children, `\n${INDENT.repeat(depth + 1)}`) : '');
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
    if (isPlaceholder(child)) {
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
  return lines;
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
  const content = holes ? placeholderHoles(node.children, '') : '';
  const children = printableChildren(node.children);
  if (children.length === 0) {
    const text = node.closed
      ? `${printCompactStartTag(node, holes)}${content}</${node.name}>`
      : `${printCompactStartTag(node, holes)}${content}`;
    return { hasText: false, text };
  }
  const childrenText = inlineChildrenText(node.children, holes);
  return childrenText === undefined || (requireText && !childrenText.hasText)
    ? undefined
    : {
        hasText: childrenText.hasText,
        text: `${printCompactStartTag(node, holes)}${childrenText.text}${content}</${node.name}>`,
      };
};

const inlineChildrenText = (children: HtmlNode[], holes: boolean): InlineText | undefined => {
  const parts: string[] = [];
  let hasText = false;
  const shown = children.filter((child) => !isPlaceholder(child));
  for (const child of shown) {
    const part = inlineChildText(child, holes);
    if (part === undefined) {
      return undefined;
    }
    hasText ||= part.hasText;
    const trim = { start: child === shown[0], end: child === shown.at(-1) };
    const text = child.kind === 'text' ? inlineText(child.text, trim.start, trim.end) : part.text;
    if (text !== '') {
      parts.push(wrapInHole(text, holes ? holeTags.get(child) : undefined, trim));
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

const printStartTag = (
  node: Pick<ElementNode, 'attributes' | 'name'>,
  depth: number,
  holes: boolean
): string => {
  const indent = INDENT.repeat(depth);
  const compact = printCompactStartTag(node, false);
  if (indent.length + compact.length <= INLINE_LIMIT || shown(node.attributes).length === 0) {
    return `${indent}${holes ? printCompactStartTag(node, true) : compact}`;
  }
  const lines = shown(node.attributes).map(
    (attribute) => `${indent}${INDENT}${printHtmlAttribute(attribute, holes)}`
  );
  const omitted = holes ? omittedHoles(node.attributes, `\n${indent}${INDENT}`) : '';
  return [
    `${indent}<${node.name}`,
    ...lines.slice(0, -1),
    lines.at(-1) + omitted,
    `${indent}>`,
  ].join('\n');
};

const printCompactStartTag = (
  node: Pick<ElementNode, 'attributes' | 'name'>,
  holes: boolean
): string => {
  const attrs = shown(node.attributes)
    .map((attribute) => printHtmlAttribute(attribute, holes))
    .join(' ');
  const omitted = holes ? omittedHoles(node.attributes, ' ') : '';
  return `<${node.name}${attrs ? ` ${attrs}` : ''}${omitted}>`;
};

const shown = (attributes: HtmlAttribute[]): HtmlAttribute[] =>
  attributes.filter((attribute) => !attribute.omitted);

// The holes of the attributes that print nothing, each after `space` once it prints.
const omittedHoles = (attributes: HtmlAttribute[], space: string): string =>
  attributes
    .filter((attribute) => attribute.omitted && attribute.hole)
    .map((attribute) => hole(attribute.hole!, '', space))
    .join('');

const printHtmlAttribute = (attribute: HtmlAttribute, holes: boolean): string => {
  const { hole: place, holeValue, name, value } = attribute;
  if (holes && holeValue !== undefined) {
    // The holes stay as they are; the text in and around them is escaped as the value is.
    const escaped = holeValue
      .split(/(⟦[^⟫⟧]*⟫|⟧)/)
      .map((part, index) => (index % 2 === 1 ? part : escapeAttribute(part)))
      .join('');
    return `${name}="${escaped}"`;
  }
  const printed = value === undefined ? name : quotedAttribute(name, value);
  return holes && place ? hole(place, printed) : printed;
};

const printableChildren = (children: HtmlNode[]): HtmlNode[] => children.filter(isPrintable);

const collapseText = (text: string): string => text.trim().replace(/\s+/g, ' ');
