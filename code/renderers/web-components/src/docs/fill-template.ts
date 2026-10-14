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

// Fills a template from `story-template.ts`, which is lit source, printing each arg as the story
// applies it. Besides the shared holes, `⟦attr name arg⟧`, `⟦bool name arg⟧` and `⟦prop name arg⟧`
// are lit's `name=${…}`, `?name=${…}` and `.name=${…}`, `⟦quoted arg⟧` is the arg inside a
// double-quoted attribute value, `⟦quoted arg '⟧` inside a single-quoted one, and `⟦raw arg⟧` the
// arg as the text of a `<style>` or `<script>`.
//
// `⟦props …⟧` is what a tag gets from the args. Each `name=arg`, `?name=arg`, `.name=arg` or
// `--name=arg` word names the attribute, boolean attribute, property or CSS custom property an arg
// sets, as Storybook's own render sets them, and `~name=arg` the attribute of the field `arg`, which
// that render sets to `false` or `null` as a property. A `!spread`, `!spreadProps` or `!toolkit`
// word prints them as `@open-wc/lit-helpers` `spread`, its `spreadProps` or
// `@wc-toolkit/storybook-helpers` does instead. A `*` word passes every arg a `-arg` or `^arg` word
// does not leave out, by its own name. A `^arg` word names an arg the element writes itself as
// well, which the snippet cannot show while set. An action is left out, as no control sets it; any
// other function has no literal, and throws.
//
// `⟦args -name…⟧` is the args as an object, without those its `-name` words name, where the story
// passes them whole to code the snippet keeps as written.
//
// `⟦style tag word…⟧` is the `<style>` part and state args write: `::part(name)=arg`,
// `:state(name)=arg` and `--name=arg` words. `⟦slot name arg⟧` is the arg as html where `name` is
// `default`, and as text in a `<span slot="name">` otherwise; html for another slot has no snippet.
//
// A hole for one arg may end with a `?text` word: the code to print, URI-encoded, while the arg is
// `undefined`, which is what a parameter default of the story's code gives it.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    if (kind === 'props') {
      return props(words, args);
    }
    if (kind === 'style') {
      return style(words, args);
    }
    if (kind === 'args') {
      return object(spreadArgs(args, words));
    }
    const [first = '', second = ''] = words;
    const [arg, fallback] = NAMED.includes(kind) ? [second, words[2]] : [first, second];
    const unset = defaultCode(fallback);
    if (unset !== undefined && args[arg] === undefined) {
      return unset;
    }
    const value = args[arg];
    switch (kind) {
      case 'attr':
        return `${first}="${attributeText(arg, value)}"`;
      case 'bool':
        return value && !isAction(value) ? attributeName(first, arg, value) : '';
      case 'prop':
        return value === undefined ? '' : property(first, arg, value);
      case 'text':
        return escapeLit(
          primitiveText(arg, value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        );
      case 'quoted':
        return attributeText(arg, value, second === "'" ? "'" : '"');
      case 'raw':
        return escapeLit(rawText(arg, value));
      case 'slot':
        return slot(first, arg, value);
      case 'operand':
        return asOperand(literal(arg, value));
      default:
        return literal(arg, value);
    }
  });

// The holes whose first word names the attribute or property the arg in the second is bound to.
const NAMED = ['attr', 'bool', 'prop', 'slot'];

type Mode = 'spread' | 'spreadProps' | 'toolkit' | undefined;

function props(words: string[], args: Args): string {
  const mode = words.find((word) => word.startsWith('!'))?.slice(1) as Mode;
  const left = new Set<string>();
  const printed = new Map<string, string>();
  const style: string[] = [];
  // Two args may set one attribute, as a field and its attribute do; the snippet shows one value.
  const put = (binding: string, arg: string, text: string) => {
    const before = printed.get(binding);
    if (text && before && before !== text) {
      throw new UnprintableArgError(arg);
    }
    if (text) {
      printed.set(binding, text);
    }
  };
  const bind = (word: string, arg: string, value: unknown) => {
    if (word.startsWith('@')) {
      return;
    }
    if (word.startsWith('.')) {
      put(word, arg, value === undefined ? '' : property(word.slice(1), arg, value));
    } else if (word.startsWith('~')) {
      put(
        word.slice(1),
        arg,
        value === false || value === null
          ? property(arg, arg, value)
          : value === ''
            ? `${attributeName(word.slice(1), arg)}=""`
            : attribute(word.slice(1), arg, value)
      );
    } else if (word.startsWith('?')) {
      const on = mode === 'toolkit' && value === 'false' ? false : value;
      put(word.slice(1), arg, on && !isAction(on) ? attributeName(word.slice(1), arg, on) : '');
    } else if (word.startsWith('--') && !mode) {
      if (!isUnset(value)) {
        style.push(`${word}: ${cssValue(arg, value)};`);
      }
    } else if (mode) {
      put(word, arg, spreadAttribute(word, arg, value));
    } else {
      put(word, arg, attribute(word, arg, value));
    }
  };
  for (const word of words) {
    if (word.startsWith('^')) {
      if (args[word.slice(1)] !== undefined) {
        throw new UnprintableArgError(word.slice(1));
      }
      left.add(word.slice(1));
    } else if (word.startsWith('-') && !word.includes('=')) {
      left.add(decodeURIComponent(word.slice(1)));
    } else if (word !== '*' && !word.startsWith('!')) {
      const [binding = '', arg = ''] = word.split(/=(.*)/);
      bind(binding, arg, args[arg]);
    }
  }
  if (words.includes('*')) {
    for (const [key, value] of Object.entries(args)) {
      // The toolkit's own spread leaves out every function.
      if (
        left.has(key) ||
        isAction(value) ||
        value === undefined ||
        (mode === 'toolkit' && typeof value === 'function')
      ) {
        continue;
      }
      if (mode === 'spreadProps') {
        put(`.${key}`, key, property(key, key, value));
      } else if (mode !== 'toolkit' || !key.startsWith('on')) {
        bind(key, key, value);
      }
    }
  }
  const attributes = [...printed.values()];
  if (style.length > 0) {
    attributes.push(`style="${escapeLit(escapeHtml(style.join(' ')))}"`);
  }
  return attributes.join(' ');
}

// The `<style>` rules of part and state args, and the custom properties of the element.
function style([tag = '', ...words]: string[], args: Args): string {
  const declarations: string[] = [];
  const rules: string[] = [];
  for (const word of words) {
    const [selector = '', arg = ''] = word.split(/=(.*)/);
    const value = args[arg];
    if (isUnset(value) || (typeof value === 'string' && value.trim() === '')) {
      continue;
    }
    if (selector.startsWith('--')) {
      declarations.push(`${selector}: ${cssValue(arg, value)};`);
    } else {
      rules.push(`  ${tag}${selector} { ${rawText(arg, value)} }`);
    }
  }
  if (declarations.length > 0) {
    rules.unshift(`  ${tag} { ${declarations.join(' ')} }`);
  }
  return rules.length === 0 ? '' : escapeLit(`<style>\n${rules.join('\n')}\n</style>\n`);
}

// A value that would end its declaration, or is no CSS value at all, has no place in a style.
function cssValue(name: string, value: unknown): string {
  if (typeof value !== 'number' && (typeof value !== 'string' || /[;{}<]/.test(value))) {
    throw new UnprintableArgError(name);
  }
  return String(value);
}

// A property is set to whatever the arg holds, `false` and `null` too, but an action. An unset arg
// is left out, as the static snippet leaves it out.
const property = (name: string, arg: string, value: unknown) =>
  isAction(value) ? '' : `.${attributeName(name, arg)}=\${${literal(arg, value)}}`;

// An attribute as Storybook's render sets it: present for `true`, left out while unset or `false`.
function attribute(name: string, arg: string, value: unknown): string {
  if (value === true || isUnset(value)) {
    return value === true ? attributeName(name, arg) : '';
  }
  if (typeof value === 'function') {
    throw new UnprintableArgError(arg);
  }
  const printed = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `${attributeName(name, arg)}="${escapeLit(escapeHtml(printed))}"`;
}

// An attribute as `spread` sets it with `setAttribute`: `String(value)`, left out for `null` and
// `undefined`. A name `setAttribute` rejects, such as `--gap`, makes the story throw.
function spreadAttribute(name: string, arg: string, value: unknown): string {
  if (!/^[A-Za-z_:][\w.:-]*$/.test(name)) {
    throw new UnprintableArgError(arg);
  }
  return value === null || value === undefined ? '' : `${name}="${attributeText(arg, value)}"`;
}

// The value lit writes in an attribute: `String(value)`, and `''` for `null` and `undefined`, in
// the quotes around it.
function attributeText(name: string, value: unknown, quote: '"' | "'" = '"'): string {
  if (typeof value === 'function' || typeof value === 'symbol' || isLitValue(value)) {
    throw new UnprintableArgError(name);
  }
  const text = String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');
  return escapeLit(quote === '"' ? text.replace(/"/g, '&quot;') : text.replace(/'/g, '&#39;'));
}

// An arg name as an attribute or property in the tag, which lit reads up to a space, quote or `=`.
// A function that is no action sets it as well, but the snippet has no literal for it.
function attributeName(name: string, arg: string, value?: unknown): string {
  if (!/^[^\s"'<>/=`$\\{}⟦⟧]+$/.test(name) || typeof value === 'function') {
    throw new UnprintableArgError(arg);
  }
  return name;
}

function primitiveText(name: string, value: unknown): string {
  if (value !== undefined && value !== null && !/string|number|boolean/.test(typeof value)) {
    throw new UnprintableArgError(name);
  }
  return String(value ?? '');
}

// The text of a `<style>` or `<script>` is not html, so only its end tag would end it early.
function rawText(name: string, value: unknown): string {
  const text = primitiveText(name, value);
  if (/<\/(style|script)/i.test(text)) {
    throw new UnprintableArgError(name);
  }
  return text;
}

function slot(name: string, arg: string, value: unknown): string {
  if (isUnset(value)) {
    return '';
  }
  // The helpers parse html for a named slot to set `slot` on each element it holds.
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    (name !== 'default' && /[<&]/.test(String(value)))
  ) {
    throw new UnprintableArgError(arg);
  }
  const html = escapeLit(String(value));
  return name === 'default' ? html : `<span slot="${name}">${html}</span>`;
}

function object(entries: [string, unknown][]): string {
  const properties = entries
    .filter(([, value]) => value !== undefined && !isAction(value))
    .map(([name, value]) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : printValue(name, name);
      return `${key}: ${literal(name, value)}`;
    });
  return properties.length === 0 ? '{}' : `{ ${properties.join(', ')} }`;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// The html sits in a lit template literal, which a backtick would end and `${` would bind in.
const escapeLit = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const isLitValue = (item: unknown) => Object.keys(Object(item)).some((key) => key.includes('$lit'));

// A lit template or directive has no literal; only the story's own render shows it.
const literal = (name: string, value: unknown) => printValue(value, name, { opaque: isLitValue });

// An action is unset too; any other function throws where it is printed.
const isUnset = (value: unknown) =>
  [undefined, null, false, ''].includes(value as never) || isAction(value);
