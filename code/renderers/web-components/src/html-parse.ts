// Html as a tree of nodes, read the way a story-docs snippet prints html. The story-docs build
// and the preview's slot rule read html with it, so it stays free of anything server-only.

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

export type ElementNode = Extract<HtmlNode, { kind: 'element' }>;
type Token =
  | { kind: 'comment'; text: string }
  | { kind: 'end'; name: string }
  | { attributes: HtmlAttribute[]; kind: 'raw'; name: string; text: string }
  | { attributes: HtmlAttribute[]; kind: 'start'; name: string; selfClosing: boolean }
  | { kind: 'text'; text: string };

const RAW_TEXT_ELEMENTS = new Set(['pre', 'script', 'style', 'textarea', 'title']);
export const VOID_ELEMENTS = new Set([
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

const decodeAttribute = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

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
