import { escapeAttribute, inlineText, quotedAttribute } from '../../snippet-values.ts';

export interface HtmlAttribute {
  name: string;
  quoted?: boolean;
  value: string | undefined;
  /**
   * The hole a template prints in place of the whole attribute, as it prints an arg. A hole fills to
   * the attribute or to nothing.
   */
  hole?: string;
  /** The value a template prints, with a hole where the value prints an arg. */
  holeValue?: string;
  /** Not printed for the args of the static snippet, but its `hole` is in the template. */
  omitted?: boolean;
}

export type HtmlNode =
  | { kind: 'comment'; text: string }
  | {
      attributes: HtmlAttribute[];
      children: HtmlNode[];
      closed: boolean;
      kind: 'element';
      name: string;
      selfClosing: boolean;
    }
  | { kind: 'malformed'; text: string }
  | { attributes: HtmlAttribute[]; closed: boolean; kind: 'rawText'; name: string; text: string }
  | { kind: 'text'; text: string }
  /**
   * The nodes of a value the static snippet prints for an arg, and the `hole` a template prints in
   * their place. It is laid out as its nodes are, so the template has the static snippet's layout.
   */
  | { hole: string; kind: 'hole'; nodes: HtmlNode[] };

type ElementNode = Extract<HtmlNode, { kind: 'element' }>;
type InlineText = { hasText: boolean; text: string };

type Token =
  | { kind: 'comment'; text: string }
  | { kind: 'end'; name: string }
  | { attributes: HtmlAttribute[]; kind: 'raw'; name: string; text: string }
  | { attributes: HtmlAttribute[]; kind: 'start'; name: string; selfClosing: boolean }
  | { kind: 'text'; text: string };

const INLINE_LIMIT = 80;
const INDENT = '  ';
const RAW_TEXT_ELEMENTS = new Set(['pre', 'script', 'style', 'textarea', 'title']);
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

export function parseHtml(source: string): HtmlNode[] {
  const root: { children: HtmlNode[] } = { children: [] };
  const stack: ({ children: HtmlNode[] } | ElementNode)[] = [root];
  let offset = 0;

  while (offset < source.length) {
    const read = readToken(source, offset);
    if (!read) {
      current(stack).children.push({ kind: 'malformed', text: source.slice(offset) });
      break;
    }
    offset = read.end;
    const token = read.token;
    switch (token.kind) {
      case 'comment':
      case 'text':
        current(stack).children.push(token);
        break;
      case 'start': {
        const node: ElementNode = {
          attributes: token.attributes,
          children: [],
          closed: token.selfClosing || VOID_ELEMENTS.has(token.name.toLowerCase()),
          kind: 'element',
          name: token.name,
          selfClosing: token.selfClosing,
        };
        current(stack).children.push(node);
        if (!node.closed) {
          stack.push(node);
        }
        break;
      }
      case 'raw':
        current(stack).children.push({
          attributes: token.attributes,
          closed: true,
          kind: 'rawText',
          name: token.name,
          text: token.text,
        });
        break;
      case 'end': {
        const top = stack.at(-1);
        if (VOID_ELEMENTS.has(token.name)) {
          break;
        }
        if (!('kind' in top!) || top.kind !== 'element' || top.name.toLowerCase() !== token.name) {
          current(stack).children.push({ kind: 'malformed', text: source.slice(read.start) });
          return root.children;
        }
        top.closed = true;
        stack.pop();
        break;
      }
      default: {
        const exhaustive: never = token;
        return exhaustive;
      }
    }
  }

  return root.children;
}

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

const current = (stack: ({ children: HtmlNode[] } | ElementNode)[]): { children: HtmlNode[] } =>
  stack[stack.length - 1];

const readToken = (
  source: string,
  start: number
): { end: number; start: number; token: Token } | undefined => {
  if (source[start] !== '<') {
    const next = source.indexOf('<', start);
    const end = next === -1 ? source.length : next;
    return { end, start, token: { kind: 'text', text: source.slice(start, end) } };
  }

  if (source.startsWith('<!--', start)) {
    const end = source.indexOf('-->', start + 4);
    if (end === -1) {
      return undefined;
    }
    return { end: end + 3, start, token: { kind: 'comment', text: source.slice(start, end + 3) } };
  }

  const end = findTagEnd(source, start);
  if (end === undefined) {
    return undefined;
  }
  const raw = source.slice(start, end);
  const endMatch = /^<\/\s*([^\s>]+)\s*>$/.exec(raw);
  if (endMatch) {
    return { end, start, token: { kind: 'end', name: endMatch[1].toLowerCase() } };
  }

  const startMatch = /^<\s*([^\s/>]+)([\s\S]*?)>$/.exec(raw);
  if (!startMatch) {
    return { end, start, token: { kind: 'text', text: raw } };
  }
  const name = startMatch[1];
  const rest = startMatch[2];
  const selfClosing = hasSelfClosingSlash(rest);
  const attrs = selfClosing ? rest.replace(/\/\s*$/, '') : rest;
  const attributes = parseAttributes(attrs.trim());
  if (!selfClosing && RAW_TEXT_ELEMENTS.has(name.toLowerCase())) {
    const rawEnd = findRawTextEnd(source, end, name);
    if (rawEnd) {
      return {
        end: rawEnd.end,
        start,
        token: { attributes, kind: 'raw', name, text: source.slice(end, rawEnd.start) },
      };
    }
  }
  return { end, start, token: { attributes, kind: 'start', name, selfClosing } };
};

const parseAttributes = (source: string): HtmlAttribute[] => {
  const attributes: HtmlAttribute[] = [];
  let index = 0;
  while (index < source.length) {
    while (/\s/.test(source[index] ?? '')) {
      index += 1;
    }
    if (index >= source.length) {
      break;
    }
    const nameStart = index;
    while (index < source.length && !/[\s=]/.test(source[index])) {
      index += 1;
    }
    const name = source.slice(nameStart, index);
    while (/\s/.test(source[index] ?? '')) {
      index += 1;
    }
    if (source[index] !== '=') {
      attributes.push({ name, value: undefined });
      continue;
    }
    index += 1;
    while (/\s/.test(source[index] ?? '')) {
      index += 1;
    }
    const quote = source[index] === '"' || source[index] === "'" ? source[index] : undefined;
    if (quote) {
      index += 1;
      const valueStart = index;
      while (index < source.length && source[index] !== quote) {
        index += 1;
      }
      attributes.push({
        name,
        quoted: true,
        value: decodeAttribute(source.slice(valueStart, index)),
      });
      if (source[index] === quote) {
        index += 1;
      }
      continue;
    }
    const valueStart = index;
    while (index < source.length && !/\s/.test(source[index])) {
      index += 1;
    }
    attributes.push({ name, value: decodeAttribute(source.slice(valueStart, index)) });
  }
  return attributes;
};

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
    // The holes in the value print what `⟦quoted⟧` prints, escaped as the text around them.
    return `${name}="${escapeAttribute(holeValue)}"`;
  }
  return value === undefined ? name : quotedAttribute(name, value);
};

const decodeAttribute = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

const printableChildren = (children: HtmlNode[]): HtmlNode[] => children.filter(isPrintable);

const collapseText = (text: string): string => text.trim().replace(/\s+/g, ' ');

// A text hole with where the snippet trims the text it prints: `^` at its start, `$` at its end. The
// filler collapses the whitespace in it as a text node prints.
const textHole = (hole: string, trimStart: boolean, trimEnd: boolean): string =>
  hole.startsWith('⟦text ')
    ? `${hole.slice(0, -1)}${trimStart ? ' ^' : ''}${trimEnd ? ' $' : ''}⟧`
    : hole;

const hasSelfClosingSlash = (rest: string): boolean => {
  let index = rest.length - 1;
  while (index >= 0 && /\s/.test(rest[index])) {
    index -= 1;
  }
  if (rest[index] !== '/') {
    return false;
  }
  return index === 0 || /\s/.test(rest[index - 1]);
};

export const findTagEnd = (source: string, start: number): number | undefined => {
  let quote: '"' | "'" | undefined;
  let canOpenQuote = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if ((char === '"' || char === "'") && canOpenQuote) {
      quote = char;
      continue;
    }
    if (/\s|=/.test(char)) {
      canOpenQuote = true;
    }
    if (char === '>') {
      return index + 1;
    }
  }
  return undefined;
};

const findRawTextEnd = (
  source: string,
  start: number,
  name: string
): { end: number; start: number } | undefined => {
  const lower = source.toLowerCase();
  const close = `</${name.toLowerCase()}`;
  let index = start;
  while (index < source.length) {
    const found = lower.indexOf(close, index);
    if (found === -1) {
      return undefined;
    }
    const boundary = source[found + close.length];
    if (boundary !== undefined && /[\s>]/.test(boundary)) {
      const end = findTagEnd(source, found);
      return end === undefined ? undefined : { end, start: found };
    }
    index = found + close.length;
  }
  return undefined;
};
