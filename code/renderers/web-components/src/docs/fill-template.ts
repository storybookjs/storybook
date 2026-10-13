import {
  type FillSnippetTemplate,
  UnprintableArgError,
  fillHoles,
  printValue,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `story-template.ts`. Besides the shared holes, `⟦bool name arg⟧` is lit's
// `?name=${…}`, and each word of `⟦props label=label .items=items --gap=--gap⟧` names the attribute,
// `.property` or CSS custom property an arg sets; an arg no word names, such as a listener, is left
// out.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', second = ''] = words;
    switch (kind) {
      case 'props':
        return props(words, args);
      case 'attr':
        return attribute(first, args[second]);
      case 'bool':
        return args[second] ? ` ${first}` : '';
      case 'text':
        return text(first, args[first]);
      default:
        return literal(first, args[first]);
    }
  });

function props(words: string[], args: Args): string {
  let attributes = '';
  let style = '';
  for (const word of words) {
    const [binding = '', name = ''] = word.split(/=(.*)/);
    if (isUnset(args[name])) {
      continue;
    } else if (binding.startsWith('--')) {
      style += ` ${binding}: ${args[name]};`;
    } else if (binding.startsWith('.')) {
      attributes += ` ${binding}=\${${literal(name, args[name])}}`;
    } else {
      attributes += attribute(binding, args[name]);
    }
  }
  return style ? `${attributes}${attribute('style', style.trim())}` : attributes;
}

// A function arg, such as an action, is left out, as no control changes it.
function attribute(name: string, value: unknown): string {
  if (value === true || isUnset(value)) {
    return value === true ? ` ${name}` : '';
  }
  const printed = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return ` ${name}="${printed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}"`;
}

function text(name: string, value: unknown): string {
  if (value !== undefined && value !== null && !/string|number|boolean/.test(typeof value)) {
    throw new UnprintableArgError(name);
  }
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// A lit template or directive has no literal; only the story's own render shows it.
const literal = (name: string, value: unknown) =>
  printValue(value, name, {
    opaque: (item) => Object.keys(Object(item)).some((key) => key.includes('$lit')),
  });

const isUnset = (value: unknown) =>
  [undefined, null, false, ''].includes(value as never) || typeof value === 'function';
