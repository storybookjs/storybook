import { escapeAttribute } from './print-element.ts';

export interface HtmlAttribute {
  name: string;
  quoted?: boolean;
  value: string | undefined;
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
  | { kind: 'text'; text: string };

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

export function printHtml(nodes: HtmlNode[]): string {
  return printableChildren(nodes)
    .map((node) => printNode(node, 0))
    .join('\n');
}

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

const printNode = (node: HtmlNode, depth: number): string => {
  const indent = INDENT.repeat(depth);
  switch (node.kind) {
    case 'comment':
      return `${indent}${node.text}`;
    case 'element':
      return printElement(node, depth);
    case 'malformed':
      return node.text;
    case 'rawText':
      return printRawTextElement(node, depth);
    case 'text':
      return `${indent}${collapseText(node.text)}`;
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};

const printElement = (node: ElementNode, depth: number): string => {
  const indent = INDENT.repeat(depth);
  const startTag = printStartTag(node, depth);
  if (VOID_ELEMENTS.has(node.name.toLowerCase())) {
    return startTag;
  }
  if (node.selfClosing) {
    return `${startTag}</${node.name}>`;
  }

  const children = printableChildren(node.children);
  if (children.length === 0) {
    return node.closed ? `${startTag}</${node.name}>` : startTag;
  }

  const inline = inlineElementText(node, true)?.text;
  if (inline) {
    if (indent.length + inline.length <= INLINE_LIMIT) {
      return `${indent}${inline}`;
    }
  }

  const body = printChildLines(node.children, depth + 1).join('\n');
  return node.closed ? `${startTag}\n${body}\n${indent}</${node.name}>` : `${startTag}\n${body}`;
};

const printChildLines = (children: HtmlNode[], depth: number): string[] => {
  const lines: string[] = [];
  let group: HtmlNode[] = [];
  const flushGroup = (): void => {
    if (group.length === 0) {
      return;
    }
    const inline = inlineChildrenText(group);
    const indent = INDENT.repeat(depth);
    if (inline && inline.hasText && indent.length + inline.text.length <= INLINE_LIMIT) {
      lines.push(`${indent}${inline.text}`);
    } else {
      group.forEach((child) => lines.push(printNode(child, depth)));
    }
    group = [];
  };

  for (const child of children) {
    if (child.kind === 'text' && collapseText(child.text) === '') {
      flushGroup();
      continue;
    }
    if (inlineChildText(child)) {
      group.push(child);
      continue;
    }
    flushGroup();
    lines.push(printNode(child, depth));
  }
  flushGroup();
  return lines;
};

const inlineElementText = (node: ElementNode, requireText = true): InlineText | undefined => {
  const lowerName = node.name.toLowerCase();
  if (VOID_ELEMENTS.has(lowerName)) {
    return { hasText: false, text: printCompactStartTag(node) };
  }
  if (node.selfClosing) {
    return { hasText: false, text: `${printCompactStartTag(node)}</${node.name}>` };
  }
  const children = printableChildren(node.children);
  if (children.length === 0) {
    const text = node.closed
      ? `${printCompactStartTag(node)}</${node.name}>`
      : printCompactStartTag(node);
    return { hasText: false, text };
  }
  const childrenText = inlineChildrenText(node.children);
  return childrenText === undefined || (requireText && !childrenText.hasText)
    ? undefined
    : {
        hasText: childrenText.hasText,
        text: `${printCompactStartTag(node)}${childrenText.text}</${node.name}>`,
      };
};

const inlineChildrenText = (children: HtmlNode[]): InlineText | undefined => {
  const parts: string[] = [];
  let hasText = false;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const part = inlineChildText(child);
    if (part === undefined) {
      return undefined;
    }
    if (part.text !== '') {
      parts.push(
        child.kind === 'text'
          ? inlineText(child.text, index === 0, index === children.length - 1)
          : part.text
      );
    }
    hasText ||= part.hasText;
  }
  return { hasText, text: parts.join('') };
};

const inlineChildText = (node: HtmlNode): InlineText | undefined => {
  switch (node.kind) {
    case 'text':
      return collapseText(node.text) === '' ? undefined : { hasText: true, text: node.text };
    case 'element': {
      if (!isInlineChildElement(node)) {
        return undefined;
      }
      const inline = inlineElementText(node, false);
      return inline ? { hasText: false, text: inline.text } : undefined;
    }
    case 'comment':
    case 'malformed':
    case 'rawText':
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
  depth: number
): string => {
  const startTag = printStartTag({ attributes: node.attributes, name: node.name }, depth);
  return node.closed ? `${startTag}${node.text}</${node.name}>` : `${startTag}${node.text}`;
};

const printStartTag = (node: Pick<ElementNode, 'attributes' | 'name'>, depth: number): string => {
  const indent = INDENT.repeat(depth);
  const compact = printCompactStartTag(node);
  if (indent.length + compact.length <= INLINE_LIMIT) {
    return `${indent}${compact}`;
  }
  if (node.attributes.length === 0) {
    return `${indent}<${node.name}>`;
  }
  return [
    `${indent}<${node.name}`,
    ...node.attributes.map((attr) => `${indent}${INDENT}${printHtmlAttribute(attr)}`),
    `${indent}>`,
  ].join('\n');
};

const printCompactStartTag = (node: Pick<ElementNode, 'attributes' | 'name'>): string => {
  const attrs = node.attributes.map(printHtmlAttribute).join(' ');
  const suffix = attrs ? ` ${attrs}` : '';
  return `<${node.name}${suffix}>`;
};

const printHtmlAttribute = ({ name, value }: HtmlAttribute): string =>
  value === undefined ? name : `${name}="${escapeAttribute(value)}"`;

const decodeAttribute = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

const printableChildren = (children: HtmlNode[]): HtmlNode[] =>
  children.filter((child) => child.kind !== 'text' || collapseText(child.text) !== '');

const collapseText = (text: string): string => text.trim().replace(/\s+/g, ' ');

const inlineText = (text: string, first: boolean, last: boolean): string => {
  let collapsed = text.replace(/\s+/g, ' ');
  if (first) {
    collapsed = collapsed.trimStart();
  }
  if (last) {
    collapsed = collapsed.trimEnd();
  }
  return collapsed;
};

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

const findTagEnd = (source: string, start: number): number | undefined => {
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
