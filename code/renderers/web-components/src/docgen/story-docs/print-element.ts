import { legacyHole as hole, holeWord } from 'storybook/internal/docs-tools';

import {
  attributeText,
  cssDeclarations,
  slotPlacement,
  slotText,
  slottedHtml,
  styleElement,
} from '../../snippet-values.ts';
import { type HtmlAttribute, type HtmlNode, parseHtml } from '../../html-parse.ts';
import { printHtml } from './html-tree.ts';

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
    return withScript(
      [...(rules.length > 0 ? [styleElement(rules)] : []), printHtml([element])].join('\n')
    );
  }
  // The `<style>` of the part and state args fills to its html and a line break, or to nothing.
  const styleArgs = snippet.styleRules.filter((rule) => rule.arg !== undefined);
  const style =
    styleArgs.length > 0
      ? hole('style', ...styleArgs.map((rule) => holeWord(`${rule.selector}=${rule.arg}`)))
      : rules.length > 0
        ? `${styleElement(rules)}\n`
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
  const style = cssDeclarations(snippet.cssProperties);
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

const attributeNode = ({
  name,
  value,
  viaField,
}: ElementSnippet['attributes'][number]): HtmlAttribute | undefined => {
  const text = attributeText(value, viaField);
  return text === undefined ? undefined : { name, value: text === true ? undefined : text };
};

// The html of each slot an arg sets is a hole in the template, `⟦slot name arg⟧`.
const slotNodes = (slots: ElementSnippet['slots']): HtmlNode[] => {
  let content = 0;
  return slots.flatMap((slot): HtmlNode[] => {
    const html = slotText(slot.html);
    const separator = html !== '' && content++ > 0 ? [slotSeparatorNode()] : [];
    const nodes = html !== '' ? nodesForSlot(slot.name, html) : [];
    return slot.arg === undefined
      ? [...separator, ...nodes]
      : [
          ...separator,
          { hole: hole('slot', holeWord(slot.name), holeWord(slot.arg)), kind: 'hole', nodes },
        ];
  });
};

const slotSeparatorNode = (): HtmlNode => ({ kind: 'text', text: '\n' });

// A `<span>` takes the `slot` attribute as a node around the html's own nodes, which html that
// does not close each element it opens keeps.
const nodesForSlot = (name: string, content: string): HtmlNode[] =>
  slotPlacement(name, content) === 'span'
    ? [
        {
          attributes: [{ name: 'slot', value: name }],
          children: parseHtml(content),
          closed: true,
          kind: 'element',
          name: 'span',
          selfClosing: false,
        },
      ]
    : parseHtml(slottedHtml(name, content));

const escapeScriptString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3C');

const sanitizeScriptHandler = (value: string): string =>
  value
    .replace(/<!--/g, '<\\!--')
    .replace(/<script/gi, '<\\script')
    .replace(/<\/script/gi, '<\\/script');
