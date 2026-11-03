import {
  type FillSnippetTemplate,
  UnprintableArgError,
  fillHoles,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `build-story-docs.ts`: the html of the static snippet with a hole wherever
// it prints an arg. Each hole prints its arg's value as the static snippet prints a value in that
// place; the layout is the template's.
//
// `⟦attr name arg mode⟧` is an attribute, or nothing:
// - no mode: the attribute Storybook's render sets, bare while `true`, left out while `false`,
//   unset or empty, its value JSON for an object; `field`: as that, but `name=""` while empty.
// - `bind`: lit's `name=${arg}`, its value the arg's text; `defined`: lit's
//   `name=${ifDefined(arg)}`, left out while unset.
// - `css`, with words `property=arg`: the `style` attribute of the custom properties.
// `⟦bool name arg⟧` is lit's `?name=${arg}`, `⟦quoted arg⟧` text in a quoted attribute value,
// `⟦text arg⟧` the text of a lit template, its whitespace collapsed and trimmed at a `^` start or
// `$` end as the snippet prints a text node there, `⟦slot name arg⟧` the html of a slot, and
// `⟦style selector=arg…⟧` the `<style>` of part and state args.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => fill(kind, words, args));

function fill(kind: string, words: string[], args: Args): string {
  switch (kind) {
    case 'attr':
      return attribute(words, args);
    case 'bool': {
      const [name = '', arg = ''] = words;
      return printable(arg, args[arg]) ? name : '';
    }
    case 'quoted': {
      const [arg = ''] = words;
      return escape(textOf(arg, args[arg]), QUOTED);
    }
    case 'text': {
      const [arg = '', ...trims] = words;
      return escape(collapse(textOf(arg, args[arg]), trims), TEXT);
    }
    case 'slot': {
      const [name = '', arg = ''] = words;
      return slot(name, textOf(arg, args[arg]));
    }
    case 'style':
      return style(words, args);
    default:
      // A hole of another renderer's template, which this one cannot print.
      throw new UnprintableArgError(words[1] ?? words[0] ?? kind);
  }
}

function attribute([name = '', arg = '', mode, ...rest]: string[], args: Args): string {
  if (mode === 'css') {
    const declarations = rest.flatMap((word) => {
      const [property = '', key = ''] = word.split(/=(.*)/);
      const value = args[key];
      return value === null || value === undefined || value === ''
        ? []
        : [`${property}: ${String(printable(key, value))};`];
    });
    return declarations.length === 0 ? '' : `style="${escape(declarations.join(' '), QUOTED)}"`;
  }
  const value = printable(arg, args[arg]);
  if (mode === 'bind' || mode === 'defined') {
    if (value === undefined || value === null) {
      return mode === 'defined' ? '' : `${name}=""`;
    }
    return `${name}="${escape(String(value), QUOTED)}"`;
  }
  if (value === true) {
    return name;
  }
  if (value === '') {
    return mode === 'field' ? `${name}=""` : '';
  }
  if (value === false || value === null || value === undefined) {
    return '';
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `${name}="${escape(text, QUOTED)}"`;
}

// The html of a slot, which a named slot gives its one element, or a span around it.
function slot(name: string, html: string): string {
  if (html === '' || name === 'default') {
    return html;
  }
  const only = /^<([A-Za-z][^\s/>]*)(\s[^>]*)?>[\s\S]*<\/\1>$/.exec(html);
  // The snippet adds the attribute after those the element has.
  return only && !/\sslot=/.test(only[2] ?? '') && !html.slice(1).includes(`<${only[1]}`)
    ? html.replace(
        /^<([^\s/>]+)(\s[^>]*)?>/,
        (_, tag: string, attributes = '') =>
          `<${tag}${attributes.trimEnd()} slot="${escape(name, QUOTED)}">`
      )
    : `<span slot="${escape(name, QUOTED)}">${html}</span>`;
}

function style(words: string[], args: Args): string {
  const rules = words.flatMap((word) => {
    const [selector = '', arg = ''] = word.split(/=(.*)/);
    const value = printable(arg, args[arg]);
    return value === undefined ? [] : [`  ${selector} { ${String(value)} }`];
  });
  return rules.length === 0 ? '' : `<style>\n${rules.join('\n')}\n</style>\n`;
}

// The text a value prints as: none while unset or empty, an array its items joined.
function textOf(arg: string, value: unknown): string {
  const printed = printable(arg, value);
  if (printed === null || printed === undefined) {
    return '';
  }
  return Array.isArray(printed) ? printed.map((item) => item ?? '').join('') : String(printed);
}

// Whitespace collapsed to one space, as a text node prints, and trimmed where `trims` says.
function collapse(text: string, trims: string[]): string {
  let collapsed = text.replace(/\s+/g, ' ');
  if (trims.includes('^')) {
    collapsed = collapsed.trimStart();
  }
  if (trims.includes('$')) {
    collapsed = collapsed.trimEnd();
  }
  return collapsed;
}

const QUOTED = /[&<"]/g;
const TEXT = /[&<>]/g;
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

const escape = (text: string, characters: RegExp) =>
  text.replace(characters, (character) => ENTITIES[character]!);

// A function, or a lit template or directive, has no html the snippet could show.
function printable(arg: string, value: unknown): unknown {
  if (typeof value === 'function' || typeof value === 'symbol' || isLitValue(value)) {
    throw new UnprintableArgError(arg);
  }
  return value;
}

const isLitValue = (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(value).some((key) => key.includes('$lit'));
