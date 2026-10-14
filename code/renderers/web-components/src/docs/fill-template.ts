import {
  type FillSnippetTemplate,
  UnprintableArgError,
  asOperand,
  defaultCode,
  fillHoles,
  printValue,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `story-template.ts`, which is lit source. Besides the shared holes,
// `⟦bool name arg⟧` is lit's `?name=${…}` and `⟦prop name arg⟧` its `.name=${…}`. Each word of
// `⟦props label=label .items=items --gap=--gap⟧` names the attribute, `.property` or CSS custom
// property an arg sets; an arg no word names, such as a listener, is left out. A `^arg` word names
// an arg the element writes itself as well, which the snippet cannot show while set. A hole for one arg
// may end with a `?text` word: the code to print, URI-encoded, while the arg is `undefined`, which
// is what a parameter default of the story's code gives it. `⟦slot name arg⟧` is the arg as html
// where `name` is `default`, and as text in a `<span slot="name">` otherwise, as
// `@wc-toolkit/storybook-helpers` renders slot args; html for another slot has no snippet.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', second = ''] = words;
    const [arg, fallback] = NAMED.includes(kind) ? [second, words[2]] : [first, second];
    const unset = kind === 'props' ? undefined : defaultCode(fallback);
    if (unset !== undefined && args[arg] === undefined) {
      return unset;
    }
    switch (kind) {
      case 'props':
        return props(words, args);
      case 'attr':
        // lit writes a boolean in an attribute binding as `"true"` or `"false"`.
        return attribute(
          first,
          typeof args[second] === 'boolean' ? String(args[second]) : args[second]
        );
      case 'bool':
        return args[second] ? first : '';
      case 'prop':
        return property(first, second, args);
      case 'text':
        return text(first, args[first]);
      case 'slot':
        return slot(first, second, args[second]);
      case 'operand':
        return asOperand(literal(first, args[first]));
      default:
        return literal(first, args[first]);
    }
  });

// The holes whose first word names the attribute or property the arg in the second is bound to.
const NAMED = ['attr', 'bool', 'prop', 'slot'];

function props(words: string[], args: Args): string {
  const attributes: string[] = [];
  const style: string[] = [];
  for (const word of words) {
    const [binding = '', name = ''] = word.split(/=(.*)/);
    if (word.startsWith('^')) {
      if (args[word.slice(1)] !== undefined) {
        throw new UnprintableArgError(word.slice(1));
      }
    } else if (binding.startsWith('--') && !isUnset(args[name])) {
      style.push(`${binding}: ${cssValue(name, args[name])};`);
    } else if (binding.startsWith('.')) {
      attributes.push(property(binding.slice(1), name, args));
    } else {
      attributes.push(attribute(binding, args[name]));
    }
  }
  attributes.push(attribute('style', style.join(' ')));
  return attributes.filter(Boolean).join(' ');
}

// A value that would end its declaration, or is no CSS value at all, has no place in `style`.
function cssValue(name: string, value: unknown): string {
  if (typeof value !== 'number' && (typeof value !== 'string' || /[;{}]/.test(value))) {
    throw new UnprintableArgError(name);
  }
  return String(value);
}

// A property is set to whatever the arg holds, `false` and `null` too, but an action.
const property = (name: string, arg: string, args: Args) =>
  args[arg] === undefined || typeof args[arg] === 'function'
    ? ''
    : `.${name}=\${${literal(arg, args[arg])}}`;

// A function arg, such as an action, is left out, as no control changes it.
function attribute(name: string, value: unknown): string {
  if (value === true || isUnset(value)) {
    return value === true ? name : '';
  }
  const printed = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `${name}="${escapeLit(printed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'))}"`;
}

function text(name: string, value: unknown): string {
  if (value !== undefined && value !== null && !/string|number|boolean/.test(typeof value)) {
    throw new UnprintableArgError(name);
  }
  return escapeLit(
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  );
}

function slot(name: string, arg: string, value: unknown): string {
  if (isUnset(value) || typeof value === 'function') {
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

// The html sits in a lit template literal, which a backtick would end and `${` would bind in.
const escapeLit = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

// A lit template or directive has no literal; only the story's own render shows it.
const literal = (name: string, value: unknown) =>
  printValue(value, name, {
    opaque: (item) => Object.keys(Object(item)).some((key) => key.includes('$lit')),
  });

const isUnset = (value: unknown) =>
  [undefined, null, false, ''].includes(value as never) || typeof value === 'function';
