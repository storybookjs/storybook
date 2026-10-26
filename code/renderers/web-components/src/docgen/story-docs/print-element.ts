import type { HtmlAttribute, HtmlNode } from './html-tree.ts';
import { parseHtml, printHtml } from './html-tree.ts';

export interface ElementSnippet {
  tag: string;
  attributes: {
    name: string;
    value: unknown;
    viaField?: boolean;
    defaultValue?: string;
    source?: string;
  }[];
  cssProperties: { name: string; value: unknown }[];
  listeners: { event: string; handler: string; tag: string }[];
  slots: { name: string; html: unknown }[];
  styleRules: { selector: string; declarations: string }[];
}

export function escapeAttribute(value: string, quote: '"' | "'" = '"'): string {
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return quote === "'" ? escaped.replace(/'/g, '&#39;') : escaped.replace(/"/g, '&quot;');
}

export function printElementSnippet(snippet: ElementSnippet): string {
  const nodes = [
    ...styleNodes(snippet.styleRules),
    {
      attributes: elementAttributes(snippet),
      children: slotNodes(snippet.slots),
      closed: true,
      kind: 'element' as const,
      name: snippet.tag,
      selfClosing: false,
    },
  ];
  const element = printHtml(nodes);
  const listenerScript = printListenerScript(snippet.tag, snippet.listeners);
  return listenerScript ? `${element}\n${listenerScript}` : element;
}

export function printListenerScript(
  tag: string,
  listeners: { event: string; handler: string; tag: string }[]
): string | undefined {
  const uniqueListeners = uniqueListenersByEvent(
    listeners.filter((listener) => listener.tag === tag)
  );
  if (uniqueListeners.length === 0) {
    return undefined;
  }
  const lines = uniqueListeners.map(({ event, handler }) => {
    const target = 'host';
    return `    ${target}.addEventListener('${escapeScriptString(
      event
    )}', ${sanitizeScriptHandler(handler)});`;
  });
  return `<script>
  {
    const host = document.currentScript.previousElementSibling;
${lines.join('\n')}
  }
</script>`;
}

export function printRootListenerScript(
  listeners: { event: string; handler: string }[]
): string | undefined {
  const uniqueListeners = uniqueListenersByEvent(listeners);
  if (uniqueListeners.length === 0) {
    return undefined;
  }
  const lines = uniqueListeners.map(
    ({ event, handler }) =>
      `    host.addEventListener('${escapeScriptString(event)}', ${sanitizeScriptHandler(handler)});`
  );
  return `<script>
  {
    const host = document.currentScript.previousElementSibling;
${lines.join('\n')}
  }
</script>`;
}

const uniqueListenersByEvent = (
  listeners: { event: string; handler: string; tag?: string }[]
): { event: string; handler: string; tag?: string }[] => {
  const events = new Set<string>();
  return listeners.filter(({ event }) => {
    if (events.has(event)) {
      return false;
    }
    events.add(event);
    return true;
  });
};

const styleNodes = (rules: ElementSnippet['styleRules']): HtmlNode[] =>
  rules.length === 0
    ? []
    : [
        {
          attributes: [],
          closed: true,
          kind: 'rawText',
          name: 'style',
          text: `\n${rules
            .map(({ selector, declarations }) => `  ${selector} { ${declarations} }`)
            .join('\n')}\n`,
        },
      ];

const elementAttributes = (snippet: ElementSnippet): HtmlAttribute[] => {
  const attributes = snippet.attributes
    .map(attributeNode)
    .filter((attribute): attribute is HtmlAttribute => attribute !== undefined);
  const style = printCssProperties(snippet.cssProperties);
  return [...attributes, ...(style ? [{ name: 'style', value: style }] : [])];
};

export function printAttribute({
  name,
  value,
  viaField,
}: ElementSnippet['attributes'][number]): string | undefined {
  if (value === true) {
    return name;
  }
  if (value === '') {
    return viaField ? `${name}=""` : undefined;
  }
  if (value === false || value === null || value === undefined) {
    return undefined;
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `${name}="${escapeAttribute(text)}"`;
}

const printCssProperties = (properties: ElementSnippet['cssProperties']): string | undefined => {
  const declarations = properties
    .filter(({ value }) => value !== null && value !== undefined && value !== '')
    .map(({ name, value }) => `${name}: ${String(value)};`);
  return declarations.length === 0 ? undefined : declarations.join(' ');
};

const attributeNode = ({
  name,
  value,
  viaField,
}: ElementSnippet['attributes'][number]): HtmlAttribute | undefined => {
  if (value === true) {
    return { name, value: undefined };
  }
  if (value === '') {
    return viaField ? { name, value: '' } : undefined;
  }
  if (value === false || value === null || value === undefined) {
    return undefined;
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return { name, value: text };
};

const hasSlotContent = ({ html }: ElementSnippet['slots'][number]): boolean =>
  html !== null && html !== undefined && html !== '';

const slotNodes = (slots: ElementSnippet['slots']): HtmlNode[] => {
  const contentSlots = slots.filter(hasSlotContent);
  return contentSlots.flatMap(({ name, html }, index) => [
    ...(index === 0 ? [] : [slotSeparatorNode()]),
    ...nodesForSlot(name, String(html)),
  ]);
};

const slotSeparatorNode = (): HtmlNode => ({ kind: 'text', text: '\n' });

const nodesForSlot = (name: string, content: string): HtmlNode[] => {
  const nodes = parseHtml(content);
  if (name === 'default') {
    return nodes;
  }
  const [only] = nodes;
  if (
    nodes.length === 1 &&
    only?.kind === 'element' &&
    !only.selfClosing &&
    !hasSlotAttribute(only)
  ) {
    only.attributes.push({ name: 'slot', value: name });
    return nodes;
  }
  return [
    {
      attributes: [{ name: 'slot', value: name }],
      children: nodes,
      closed: true,
      kind: 'element',
      name: 'span',
      selfClosing: false,
    },
  ];
};

const hasSlotAttribute = (node: Extract<HtmlNode, { kind: 'element' }>): boolean =>
  node.attributes.some((attribute) => attribute.name === 'slot');

const escapeScriptString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3C');

const sanitizeScriptHandler = (value: string): string =>
  value
    .replace(/<!--/g, '<\\!--')
    .replace(/<script/gi, '<\\script')
    .replace(/<\/script/gi, '<\\/script');
