import { hole, holeWord } from 'storybook/internal/docs-tools';

import type { HtmlAttribute, HtmlNode } from './html-tree.ts';
import { parseHtml, printHtml } from './html-tree.ts';

/**
 * What the element of a story without a render prints. An entry with an `arg` prints a hole in the
 * template; one whose value is `undefined` (or, for a style rule, whose declarations are) is an arg
 * the story does not set, which only the template has.
 */
export interface ElementSnippet {
  tag: string;
  attributes: {
    name: string;
    value: unknown;
    viaField?: boolean;
    defaultValue?: string;
    source?: string;
    arg?: string;
  }[];
  cssProperties: { name: string; value: unknown; arg?: string }[];
  listeners: { event: string; handler: string; tag: string }[];
  slots: { name: string; html: unknown; arg?: string }[];
  styleRules: { selector: string; declarations: string | undefined; arg?: string }[];
}

export function escapeAttribute(value: string, quote: '"' | "'" = '"'): string {
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return quote === "'" ? escaped.replace(/'/g, '&#39;') : escaped.replace(/"/g, '&quot;');
}

/**
 * The element with its args. With `holes`, its template: the same html with a hole wherever it
 * prints an arg, laid out as the html is.
 */
export function printElementSnippet(snippet: ElementSnippet, holes = false): string {
  const rules = snippet.styleRules.filter(
    (rule): rule is { selector: string; declarations: string } => rule.declarations !== undefined
  );
  const element: HtmlNode = {
    attributes: elementAttributes(snippet),
    children: slotNodes(snippet.slots),
    closed: true,
    kind: 'element' as const,
    name: snippet.tag,
    selfClosing: false,
  };
  const listenerScript = printListenerScript(snippet.tag, snippet.listeners);
  const withScript = (html: string) => (listenerScript ? `${html}\n${listenerScript}` : html);
  if (!holes) {
    return withScript(printHtml([...styleNodes(rules), element]));
  }
  // The `<style>` of the part and state args fills to its html and a line break, or to nothing.
  const styleArgs = snippet.styleRules.filter((rule) => rule.arg !== undefined);
  const style =
    styleArgs.length > 0
      ? hole('style', ...styleArgs.map((rule) => holeWord(`${rule.selector}=${rule.arg}`)))
      : rules.length > 0
        ? `${printHtml(styleNodes(rules))}\n`
        : '';
  return withScript(`${style}${printHtml([element], true)}`);
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

const styleNodes = (rules: { selector: string; declarations: string }[]): HtmlNode[] =>
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

// Each attribute an arg prints is a hole in the template: `⟦attr name arg⟧`, or `⟦attr name arg
// field⟧` for one a field reflects, and `⟦attr style - css property=arg…⟧` for the custom properties.
const elementAttributes = (snippet: ElementSnippet): HtmlAttribute[] => {
  const attributes = snippet.attributes.flatMap((attribute): HtmlAttribute[] => {
    const node = attributeNode(attribute);
    if (attribute.arg === undefined) {
      return node ? [node] : [];
    }
    const attributeHole = hole(
      'attr',
      holeWord(attribute.name),
      holeWord(attribute.arg),
      ...(attribute.viaField ? ['field'] : [])
    );
    return [
      {
        ...(node ?? { name: attribute.name, value: undefined, omitted: true }),
        hole: attributeHole,
      },
    ];
  });
  const style = printCssProperties(snippet.cssProperties);
  const styleArgs = snippet.cssProperties.filter((property) => property.arg !== undefined);
  const styleHole =
    styleArgs.length > 0
      ? hole(
          'attr',
          'style',
          '-',
          'css',
          ...styleArgs.map((property) => holeWord(`${property.name}=${property.arg}`))
        )
      : undefined;
  return [
    ...attributes,
    ...(style || styleHole
      ? [
          {
            name: 'style',
            value: style,
            ...(style ? {} : { omitted: true }),
            ...(styleHole ? { hole: styleHole } : {}),
          },
        ]
      : []),
  ];
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

// The html of each slot an arg sets is a hole in the template, `⟦slot name arg⟧`.
const slotNodes = (slots: ElementSnippet['slots']): HtmlNode[] => {
  let content = 0;
  return slots.flatMap((slot): HtmlNode[] => {
    const shown = hasSlotContent(slot);
    const separator = shown && content++ > 0 ? [slotSeparatorNode()] : [];
    const nodes = shown ? nodesForSlot(slot.name, String(slot.html)) : [];
    return slot.arg === undefined
      ? [...separator, ...nodes]
      : [
          ...separator,
          { hole: hole('slot', holeWord(slot.name), holeWord(slot.arg)), kind: 'hole', nodes },
        ];
  });
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
