import {
  type FillSnippetTemplate,
  UnprintableArgError,
  asOperand,
  defaultCode,
  fillHoles,
  isAction,
  printValue,
  spreadArgs,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `story-template.ts` or `build-story-docs.ts`; the server writes each
// binding, and this prints the value in it. Every Web Components snippet is lit code, the html of a
// lit template or code with lit templates in it, so any text a hole prints is also escaped for a
// template literal.
//
// Besides the shared holes, `⟦attr name arg⟧` is an attribute, left out while unset, `false` or
// empty, but for an empty one a field reflects (`⟦attr name arg field⟧`); `⟦bool name arg⟧` and
// `⟦prop name arg⟧` are lit's `?name` and `.name` bindings; `⟦text arg⟧` is html text,
// `⟦quoted arg⟧` text in a double-quoted attribute value (`⟦quoted arg '⟧` single-quoted) and
// `⟦raw arg⟧` the text of a `<style>` or `<script>`. A value that is no text, such as the code the
// story writes an arg with, is a binding there instead.
// `⟦slot name arg⟧` is the html of a slot, `⟦css name=arg…⟧` the custom properties of a `style`
// attribute, with the space before it, and `⟦style tag selector=arg…⟧` the `<style>` of part and
// state args. `⟦args -name…⟧` is the args as an object, without those its `-name` words name.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    if (kind === 'css' || kind === 'style' || kind === 'args') {
      return { css, style, args: object }[kind](words, args);
    }
    const [name = '', arg = '', quote] = ['attr', 'bool', 'prop', 'slot'].includes(kind)
      ? words
      : ['', ...words];
    const value = args[arg];
    // A hole for one arg may end with a `?code` word, the code to print while it is `undefined`.
    const unset = value === undefined ? defaultCode(words.at(-1)) : undefined;
    if (unset !== undefined) {
      return unset;
    }
    const binding = (prefix: string) => `${prefix}\${${literal(arg, value)}}`;
    const primitive = isPrimitive(value);
    switch (kind) {
      case 'quoted':
      case 'text':
      case 'raw': {
        const escape = kind === 'quoted' && quote === "'" ? /[&<']/g : ESCAPES[kind];
        return primitive ? text(arg, value, escape) : binding('');
      }
      case 'attr':
        if (!primitive) {
          return binding(`${name}=`);
        }
        // An attribute a field reflects, `⟦attr name arg field⟧`, keeps an empty string.
        return value === '' && quote === 'field'
          ? `${name}=""`
          : isEmpty(value) || value === false
            ? ''
            : value === true
              ? name
              : `${name}="${text(arg, value, ESCAPES.quoted)}"`;
      case 'bool':
        return !primitive ? binding(`?${name}=`) : value ? name : '';
      case 'prop':
        return binding(`.${name}=`);
      case 'slot': {
        // The html of a named slot is the content of a span in it.
        const html = text(arg, value, ESCAPES.raw);
        return isEmpty(value)
          ? ''
          : name === 'default'
            ? html
            : `<span slot="${name}">${html}</span>`;
      }
      default:
        return kind === 'operand' ? asOperand(literal(arg, value)) : literal(arg, value);
    }
  });

// The custom properties Storybook's render sets in the element's `style`.
function css(words: string[], args: Args): string {
  const declarations = words.flatMap((word) => {
    const [name = '', arg = ''] = word.split(/=(.*)/);
    return isEmpty(args[arg]) ? [] : [`${name}: ${text(arg, args[arg], /[&<";{}]/g)};`];
  });
  return declarations.length === 0 ? '' : ` style="${declarations.join(' ')}"`;
}

// The `<style>` rules of the part and state args that are set.
function style([tag = '', ...words]: string[], args: Args): string {
  const rules = words.flatMap((word) => {
    const [selector = '', arg = ''] = word.split(/=(.*)/);
    return isEmpty(args[arg])
      ? []
      : [`  ${tag}${selector} { ${text(arg, args[arg], ESCAPES.raw)} }`];
  });
  return rules.length === 0 ? '' : `<style>\n${rules.join('\n')}\n</style>\n`;
}

// As a spread of the args leaves out an action, which no control sets, so does the object.
function object(words: string[], args: Args): string {
  const properties = spreadArgs(args, words)
    .filter(([, value]) => value !== undefined && !isAction(value))
    .map(
      ([key, value]) =>
        `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : literal(key, key)}: ${literal(key, value)}`
    );
  return properties.length === 0 ? '{}' : `{ ${properties.join(', ')} }`;
}

// What html reads as markup in each place; the text of a `<style>` or `<script>` only its end tag.
const ESCAPES = { quoted: /[&<"]/g, text: /[&<>]/g, raw: /<\/(?=style|script)/gi };
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * A value as html text in a lit template literal, where a backtick would end it and `${` bind in
 * it; `null` and `undefined` are no text. A character `escape` matches that has no entity makes
 * the value unprintable.
 */
function text(name: string, value: unknown, escape: RegExp): string {
  return String(isPrimitive(value) ? (value ?? '') : fail(name))
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
