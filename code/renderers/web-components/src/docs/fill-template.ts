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

// Fills a template from `story-template.ts`, the story's lit source; the server decides how each arg
// is written. Besides the shared holes, `⟦bool name arg⟧` and `⟦prop name arg⟧` are lit's `?name`
// and `.name` bindings, `⟦text arg⟧` html text, `⟦quoted arg⟧` text in a double-quoted attribute
// value (`⟦quoted arg '⟧` single-quoted), and `⟦raw arg⟧` the text of a `<style>` or `<script>`.
// `⟦args -name…⟧` is the args as an object, without those its `-name` words name.
//
// `⟦props …⟧`, `⟦slot name arg⟧` and `⟦style tag selector=arg…⟧` are what Storybook's render sets
// on the element of a story without a render: a `name=arg` word an attribute, `~name=arg` the
// attribute of a field, which is a property while `false` or `null`, `.name=arg` a property and
// `--name=arg` a custom property; an attribute arg that is no text is a property too. `*` sets
// every other arg as a property, but one a `-arg` word leaves out; the snippet cannot show the arg
// of a `^arg` word while it is set. This html is no template literal, so it needs no escapes.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    if (kind === 'props' || kind === 'style' || kind === 'args') {
      return { props, style, args: object }[kind](words, args);
    }
    const [name = '', arg = '', quote] = ['bool', 'prop', 'slot'].includes(kind)
      ? words
      : ['', ...words];
    const value = args[arg];
    // A hole for one arg may end with a `?code` word, the code to print while it is `undefined`.
    const unset = value === undefined ? defaultCode(words.at(-1)) : undefined;
    if (unset !== undefined) {
      return unset;
    }
    // A value that is no text, such as the code the story writes an arg with, is a binding.
    const binding = (prefix: string) => `${prefix}\${${literal(arg, value)}}`;
    switch (kind) {
      case 'quoted':
      case 'text':
      case 'raw': {
        const escape = kind === 'quoted' && quote === "'" ? /[&<']/g : ESCAPES[kind];
        return isPrimitive(value) ? inLit(text(arg, value, escape)) : binding('');
      }
      case 'bool':
        if (isPrimitive(value)) {
          return value ? name : '';
        }
        return isAction(value) ? '' : binding(`?${name}=`);
      case 'prop':
        return property(name, arg, value);
      case 'slot':
        // Storybook's render parses html for a named slot to set `slot` on each element.
        return isUnset(value)
          ? ''
          : name === 'default'
            ? text(arg, value, ESCAPES.raw)
            : `<span slot="${name}">${/[<&]/.test(String(value)) ? fail(arg) : text(arg, value, ESCAPES.raw)}</span>`;
      default:
        return kind === 'operand' ? asOperand(literal(arg, value)) : literal(arg, value);
    }
  });

function props(words: string[], args: Args): string {
  const named = new Set(words.map((word) => word.split(/=(.*)/)[1] ?? word.slice(1)));
  const printed: string[] = [];
  const style: string[] = [];
  for (const word of words) {
    const [binding = '', arg = ''] = word.split(/=(.*)/);
    const [prefix, value] = [binding.replace(/^(~|\.|--)?.*/s, '$1'), args[arg]];
    if (word.startsWith('^') && args[word.slice(1)] !== undefined) {
      fail(word.slice(1));
    } else if (word === '*') {
      // An arg Storybook's render reads by its suffix is no property.
      for (const key of Object.keys(args)) {
        printed.push(
          named.has(key)
            ? ''
            : OTHER.test(key)
              ? property(key, key, args[key])
              : isUnset(args[key], [undefined])
                ? ''
                : fail(key)
        );
      }
    } else if (
      prefix === '.' ||
      (prefix === '~' && (value === false || value === null)) ||
      (word.includes('=') && prefix !== '--' && !isPrimitive(value))
    ) {
      // An attribute holds text; Storybook's render sets any other value as its arg's property.
      printed.push(property(prefix === '.' ? binding.slice(1) : arg, arg, value));
    } else if (!word.includes('=') || isUnset(value, prefix === '~' ? [undefined] : undefined)) {
      // A `-arg` word, or an attribute or custom property that is not set.
    } else if (prefix === '--') {
      style.push(
        `${binding}: ${/string|number/.test(typeof value) && !/[;{}<]/.test(String(value)) ? value : fail(arg)};`
      );
    } else {
      const name = binding.slice(prefix.length);
      printed.push(value === true ? name : `${name}="${text(arg, value, ESCAPES.quoted)}"`);
    }
  }
  return [
    ...printed,
    style.length > 0 ? `style="${text('style', style.join(' '), ESCAPES.quoted)}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// The `<style>` rules of the part and state args that are set.
function style([tag = '', ...words]: string[], args: Args): string {
  const rules = words.flatMap((word) => {
    const [selector = '', arg = ''] = word.split(/=(.*)/);
    return isUnset(args[arg]) || String(args[arg]).trim() === ''
      ? []
      : [`  ${tag}${selector} { ${text(arg, args[arg], ESCAPES.raw)} }`];
  });
  return rules.length === 0 ? '' : `<style>\n${rules.join('\n')}\n</style>\n`;
}

function object(words: string[], args: Args): string {
  const properties = spreadArgs(args, words)
    .filter(([, value]) => !isUnset(value, [undefined]))
    .map(
      ([key, value]) =>
        `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : literal(key, key)}: ${literal(key, value)}`
    );
  return properties.length === 0 ? '{}' : `{ ${properties.join(', ')} }`;
}

// A property is set to whatever the arg holds, `false` and `null` too, but an unset arg or action.
const property = (name: string, arg: string, value: unknown) =>
  isUnset(value, [undefined]) ? '' : `.${name}=\${${literal(arg, value)}}`;

// What html reads as markup in each place; the text of a `<style>` or `<script>` only its end tag.
const ESCAPES = { quoted: /[&<"]/g, text: /[&<>]/g, raw: /<\/(?=style|script)/gi };
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// A value as html text; `null` and `undefined` are no text.
function text(name: string, value: unknown, escape: RegExp): string {
  return isPrimitive(value)
    ? String(value ?? '').replace(escape, (char) => ENTITIES[char] ?? fail(name))
    : fail(name);
}

// Html text in a lit template literal, which a backtick would end and `${` would bind in.
const inLit = (html: string) =>
  html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const isPrimitive = (value: unknown) =>
  value === null || value === undefined || /string|number|boolean/.test(typeof value);

// An arg Storybook's render sets as a property, which lit can bind by its name.
const OTHER = /^[A-Za-z_$][\w$-]*$(?<!-(event|method|slot|part|state))/;

const fail = (name: string): never => {
  throw new UnprintableArgError(name);
};

const isLitValue = (item: unknown) => Object.keys(Object(item)).some((key) => key.includes('$lit'));

// A lit template or directive has no literal; only the story's own render shows it.
const literal = (name: string, value: unknown) => printValue(value, name, { opaque: isLitValue });

// Whether a value is one of `unset`, or an action, which no control sets.
const isUnset = (value: unknown, unset: unknown[] = [undefined, null, false, '']) =>
  unset.includes(value) || isAction(value);
