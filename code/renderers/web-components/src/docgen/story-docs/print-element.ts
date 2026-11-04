import type { HoleMarks, TemplateHole } from 'storybook/internal/docs-tools';

import {
  attributeText,
  cssDeclarations,
  slotPlacement,
  slotText,
  slottedHtml,
  styleElement,
} from '../../snippet-values.ts';
import { type HtmlAttribute, type HtmlNode, parseHtml } from '../../html-parse.ts';
import {
  type HtmlHole,
  type HtmlHolePlace,
  type HtmlSnippetTemplate,
  attrHole,
} from '../../snippet-holes.ts';
import { printHtml } from './html-tree.ts';

// What the element of a story without a render prints. The template wraps an entry with an `arg`
// in a hole; one whose value is `undefined` (or, for a style rule, whose declarations are) is an
// arg the story does not set, which only the template has.
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

// The element with its args. With `marks`, its template: the same html with each value an arg
// prints marked as a hole.
export function printElementSnippet(
  snippet: ElementSnippet,
  marks?: HoleMarks<HtmlHolePlace>
): string {
  const rules = snippet.styleRules.filter(
    (rule): rule is { selector: string; declarations: string; arg?: string } =>
      rule.declarations !== undefined
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
  if (!marks) {
    return withScript(
      [...(rules.length > 0 ? [styleElement(rules)] : []), printHtml([element])].join('\n')
    );
  }
  // Each part and state rule is a hole in the `<style>`; one the story leaves unset goes in it, or
  // is a `<style>` of its own while there is none.
  const unset = snippet.styleRules.filter(
    (rule): rule is { selector: string; declarations: undefined; arg: string } =>
      rule.declarations === undefined && rule.arg !== undefined
  );
  const rule = ({ selector, arg }: { selector: string; arg: string }): HtmlHole => ({
    kind: rules.length > 0 ? 'rule' : 'style',
    selector,
    arg,
  });
  const style =
    rules.length > 0
      ? `<style>\n${rules
          .map((written) => {
            const text = `  ${written.selector} { ${written.declarations} }`;
            return written.arg === undefined
              ? text
              : marks.mark(rule({ ...written, arg: written.arg }), text);
          })
          .join('\n')}${unset.map((arg) => marks.mark(rule(arg), '', '\n')).join('')}\n</style>\n`
      : unset.map((arg) => marks.mark(rule(arg), '')).join('');
  return withScript(`${style}${printHtml([element], marks)}`);
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

// The template has a hole for each attribute an arg prints, and for each custom property in the
// `style` attribute. While none is set, each is a `style` attribute of its own, a `cssattr` hole.
const elementAttributes = (snippet: ElementSnippet): HtmlAttribute[] => {
  const attributes = snippet.attributes.flatMap((attribute): HtmlAttribute[] => {
    const node = attributeNode(attribute);
    if (attribute.arg === undefined) {
      return node ? [node] : [];
    }
    const hole = attrHole(attribute.arg, attribute.name, attribute.viaField ? 'field' : 'render');
    return [{ ...(node ?? { name: attribute.name, value: undefined, omitted: true }), hole }];
  });
  const style = cssDeclarations(snippet.cssProperties);
  // A declaration the story leaves unset goes after the others, after a space once it prints.
  const declaration = ({
    name,
    value,
    arg,
  }: ElementSnippet['cssProperties'][number]): string | TemplateHole<HtmlHolePlace> => {
    const text = cssDeclarations([{ name, value }]) ?? '';
    return arg === undefined
      ? text
      : {
          kind: 'css',
          arg,
          ...(name !== arg && { property: name }),
          text,
          ...(text ? {} : { space: ' ' }),
        };
  };
  const set = snippet.cssProperties.filter((property) => cssDeclarations([property]));
  const unset = snippet.cssProperties.filter(
    (property): property is typeof property & { arg: string } =>
      property.arg !== undefined && !cssDeclarations([property])
  );
  if (style === undefined) {
    return [
      ...attributes,
      ...unset.map((property): HtmlAttribute => ({
        name: 'style',
        value: undefined,
        omitted: true,
        hole: {
          kind: 'cssattr',
          arg: property.arg,
          ...(property.name !== property.arg && { property: property.name }),
        },
      })),
    ];
  }
  const holeValue: HtmlSnippetTemplate = [
    ...set.flatMap((property, index) => [...(index > 0 ? [' '] : []), declaration(property)]),
    ...unset.map(declaration),
  ];
  return [...attributes, { name: 'style', value: style, holeValue }];
};

const attributeNode = ({
  name,
  value,
  viaField,
}: ElementSnippet['attributes'][number]): HtmlAttribute | undefined => {
  const text = attributeText(value, viaField);
  return text === undefined ? undefined : { name, value: text === true ? undefined : text };
};

// The template has a hole for the html of each slot an arg sets.
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
          {
            hole: { kind: 'slot', arg: slot.arg, name: slot.name },
            kind: 'hole',
            nodes,
          },
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
