import {
  type FillSnippetTemplate,
  UnprintableArgError,
  fillHoles,
  printValue,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `build-story-docs.ts`, the html the static snippet prints with a hole
// wherever it prints an arg; this prints the value in each. Every Web Components snippet is the
// html of a lit template, so any text a hole prints is also escaped for a template literal.
//
// `⟦attr name arg⟧` is an attribute, left out while unset, `false` or empty, but for an empty one
// a field reflects (`⟦attr name arg field⟧`); `⟦attr name arg defined⟧` is lit's
// `name=${ifDefined(arg)}`, left out only while `null` or `undefined`; `⟦bool name arg⟧` is lit's
// `?name` binding; `⟦text arg⟧` is html text and `⟦quoted arg⟧` text in a double-quoted attribute
// value, and `⟦slot name arg⟧` the html of a slot. A value that is no text, such as the code the
// story writes an arg with, is a binding there instead. `⟦css name=arg…⟧` is the custom properties
// of a `style` attribute, with the space before it, and `⟦style tag selector=arg…⟧` the `<style>`
// of part and state args.
//
// A start tag with a hole is one line while it fits in 80 columns, else one attribute a line, as
// the static snippet lays it out.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  let filled = '';
  let end = 0;
  for (const tag of template.matchAll(START_TAG)) {
    if (!tag[0].includes('⟦')) {
      continue;
    }
    filled += fillHoles(template.slice(end, tag.index), (kind, words) => fill(kind, words, args));
    const attributes = [...tag[2]!.matchAll(ATTRIBUTE)]
      .map(([attribute]) => fillHoles(attribute, (kind, words) => fill(kind, words, args)).trim())
      .filter(Boolean);
    const line = filled.slice(filled.lastIndexOf('\n') + 1);
    const compact = [`<${tag[1]}`, ...attributes].join(' ');
    filled +=
      line.trim() || line.length + compact.length + 1 <= 80 || attributes.length === 0
        ? `${compact}>`
        : [
            `<${tag[1]}`,
            ...attributes.map((attribute) => `${line}  ${attribute}`),
            `${line}>`,
          ].join('\n');
    end = tag.index + tag[0].length;
  }
  return filled + fillHoles(template.slice(end), (kind, words) => fill(kind, words, args));
};

// A start tag: its name, then its attributes, each a hole or a name with a double-quoted value.
const START_TAG = /<([A-Za-z][^\s/>⟦]*)((?:\s*⟦[^⟧]*⟧|\s+[^\s/>⟦"=]+(?:="[^"]*")?)*)\s*>/g;
const ATTRIBUTE = /⟦[^⟧]*⟧|[^\s⟦"=]+(?:="[^"]*")?/g;

function fill(kind: string, words: string[], args: Args): string {
  if (kind === 'css' || kind === 'style') {
    return { css, style }[kind](words, args);
  }
  const [name = '', arg = '', mode] = ['attr', 'bool', 'slot'].includes(kind)
    ? words
    : ['', ...words];
  const value = args[arg];
  const binding = (prefix: string) => `${prefix}\${${literal(arg, value)}}`;
  const primitive = isPrimitive(value);
  switch (kind) {
    case 'quoted':
    case 'text':
      return primitive ? text(arg, value, ESCAPES[kind]) : binding('');
    case 'attr':
      if (!primitive) {
        return binding(`${name}=`);
      }
      if (mode === 'defined') {
        return value === undefined || value === null
          ? ''
          : `${name}="${text(arg, value, ESCAPES.quoted)}"`;
      }
      // An attribute a field reflects, `⟦attr name arg field⟧`, keeps an empty string.
      return value === '' && mode === 'field'
        ? `${name}=""`
        : isEmpty(value) || value === false
          ? ''
          : value === true
            ? name
            : `${name}="${text(arg, value, ESCAPES.quoted)}"`;
    case 'bool':
      return !primitive ? binding(`?${name}=`) : value ? name : '';
    case 'slot': {
      // The html of a named slot is the content of a span in it.
      const html = primitive ? text(arg, value, ESCAPES.raw) : binding('');
      return isEmpty(value)
        ? ''
        : name === 'default'
          ? html
          : `<span slot="${name}">${html}</span>`;
    }
    default:
      // A hole of another renderer's template, which this one cannot print.
      return fail(arg);
  }
}

// The custom properties Storybook's render sets in the element's `style`.
function css(words: string[], args: Args): string {
  const declarations = words.flatMap((word) => {
    const [name = '', arg = ''] = word.split(/=(.*)/);
    return isEmpty(args[arg]) ? [] : [`${name}: ${styleText(arg, args[arg], /[&<";{}]/g)};`];
  });
  return declarations.length === 0 ? '' : ` style="${declarations.join(' ')}"`;
}

// The `<style>` rules of the part and state args that are set.
function style([tag = '', ...words]: string[], args: Args): string {
  const rules = words.flatMap((word) => {
    const [selector = '', arg = ''] = word.split(/=(.*)/);
    return isEmpty(args[arg])
      ? []
      : [`  ${tag}${selector} { ${styleText(arg, args[arg], ESCAPES.raw)} }`];
  });
  return rules.length === 0 ? '' : `<style>\n${rules.join('\n')}\n</style>\n`;
}

// A value in css, and the code the story writes it with as a binding, as any other hole prints it.
const styleText = (name: string, value: unknown, escape: RegExp) =>
  isPrimitive(value) ? text(name, value, escape) : `\${${literal(name, value)}}`;

// What html reads as markup in each place; the text of a `<style>` or `<script>` only its end tag.
const ESCAPES = { quoted: /[&<"]/g, text: /[&<>]/g, raw: /<\/(?=style|script)/gi };
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/**
 * A value as html text in a lit template literal, where a backtick would end it and `${` bind in
 * it; `null` and `undefined` are no text. A character `escape` matches that has no entity makes
 * the value unprintable.
 */
function text(name: string, value: unknown, escape: RegExp): string {
  return String(value ?? '')
    .replace(escape, (char) => ENTITIES[char] ?? fail(name))
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

const isPrimitive = (value: unknown) =>
  value === null || value === undefined || /string|number|boolean/.test(typeof value);

const isEmpty = (value: unknown) => value === undefined || value === null || value === '';

const fail = (name: string): never => {
  throw new UnprintableArgError(name);
};

const isLitValue = (item: unknown) => Object.keys(Object(item)).some((key) => key.includes('$lit'));

// A lit template or directive has no literal; only the story's own render shows it.
const literal = (name: string, value: unknown) => printValue(value, name, { opaque: isLitValue });
