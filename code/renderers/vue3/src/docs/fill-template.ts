import {
  ARG_PATH_PATTERN,
  type FillSnippetTemplate,
  type PrintValueOptions,
  printArgPath,
  printValue,
  resolveArgPath,
  UnprintableArgError,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { camelize, isVNode } from 'vue';

import { escapeTextContent } from './escape-text-content.ts';
import { readArgsSpread } from './template-format.ts';

const ARG_PATH = new RegExp(ARG_PATH_PATTERN, 'g');
const WHOLE_ARG_PATH = new RegExp(String.raw`^\s*(${ARG_PATH_PATTERN})\s*$`);
const QUOTED = String.raw`"[^"]*"|'[^']*'`;
const ATTRIBUTE = new RegExp(String.raw`(\s+)([^\s"'=<>/]+)(?:\s*=\s*(${QUOTED}))?`, 'g');
const ATTRIBUTES = String.raw`(?:\s+[^\s"'=<>/]+(?:\s*=\s*(?:${QUOTED}))?)*`;
// A start tag, with the end tag right after it when the element is empty.
const TAG = String.raw`(?<open><(?<tag>[A-Za-z][^\s/>]*))(?<attributes>${ATTRIBUTES})(?<close>\s*/?>)(?<empty>\s*</\k<tag>>)?`;
const INTERPOLATION = String.raw`\{\{(?<expression>[\s\S]*?)\}\}`;
const TAG_OR_INTERPOLATION = new RegExp(`${TAG}|${INTERPOLATION}`, 'g');
const BINDING = /^(?::|v-bind:|@|v-on:)/;
const ARG_ONLY = String.raw`\{\{\s*(${ARG_PATH_PATTERN})\s*\}\}`;
// A line showing only an unset arg is left out, so an empty `<template #header>` does not
// override the component's fallback content. An element left empty then closes itself.
const UNSET_SLOT_LINE = new RegExp(
  String.raw`\n[ \t]*(?:${ARG_ONLY}|<template #[\w-]+>\s*${ARG_ONLY}\s*</template>)(?=\n)`,
  'g'
);
// Text Vue would condense, or drop for the slot's fallback when empty.
const CONDENSED = /^$|^\s|\s$|\s\s|[^\S ]/;

// Fills a Vue story-docs template with the current args: `v-if="args.loading"` reads
// `v-if="true"`. Every arg path is filled in the template as written, never in a filled value.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  const scriptEnd = template.startsWith('<script') ? template.indexOf('</script>') : -1;
  const script = scriptEnd === -1 ? '' : template.slice(0, scriptEnd);
  const markup = template
    .slice(script.length)
    .replace(UNSET_SLOT_LINE, (line, text?: string, slot?: string) =>
      wholeArg(text ?? slot!, args)?.value === undefined ? '' : line
    );
  return (
    fillCode(script, args, "'", escapeInScript) +
    markup.replace(TAG_OR_INTERPOLATION, (...match) => {
      const { open, attributes, close, empty, expression } = match.at(-1) as Record<string, string>;
      if (expression !== undefined) {
        return fillInterpolation(expression, args);
      }
      const filled = open + fillAttributes(attributes, args);
      return empty && !close.includes('/') ? `${filled} />` : filled + close;
    })
  );
};

// The arg an expression reads as a whole, as `{{ args.label }}` does.
function wholeArg(expression: string, args: Args) {
  const path = WHOLE_ARG_PATH.exec(expression)?.[1];
  const resolved = path === undefined ? undefined : resolveArgPath(path, args);
  return resolved?.rest === '' ? resolved : undefined;
}

const escapeAmpersands = (code: string) => code.replace(/&(?=[#\w])/g, '&amp;');

const escapeInAttribute = (code: string, quote = '"') =>
  escapeAmpersands(code).replaceAll(quote, quote === '"' ? '&quot;' : '&#39;');

const escapeInScript = (code: string) => code.replace(/<\/(script)/gi, '<\\/$1');

// Vue decodes entities in an interpolation, and its first `}}` ends it.
const escapeInInterpolation = (code: string) => escapeAmpersands(code).replaceAll('}}', '}\\u007d');

function fillCode(
  code: string,
  args: Args,
  quote: '"' | "'",
  escape: (code: string) => string
): string {
  return code.replace(ARG_PATH, (path: string, offset: number) => {
    const printed = escape(printArgPath(path, args, { ...PRINT_OPTIONS, quote }));
    // An object literal right after `=>` would read as a block.
    return printed.startsWith('{') && /=>\s*$/.test(code.slice(0, offset))
      ? `(${printed})`
      : printed;
  });
}

function fillInterpolation(expression: string, args: Args): string {
  const arg = wholeArg(expression, args);
  if (!arg) {
    return `{{ ${fillCode(expression, args, "'", escapeInInterpolation).trim()} }}`;
  }
  const { value, key } = arg;
  if (value === undefined || value === null) {
    return '';
  }
  // A function, such as a slot function, renders what it returns, which the snippet cannot know.
  if (typeof value === 'function') {
    throw new UnprintableArgError(key);
  }
  if (typeof value !== 'object' && !CONDENSED.test(String(value))) {
    return escapeTextContent(String(value));
  }
  return `{{ ${escapeInInterpolation(printValue(value, { ...PRINT_OPTIONS, quote: "'", name: key }))} }}`;
}

function fillAttributes(attributes: string, args: Args): string {
  return attributes.replace(
    ATTRIBUTE,
    (text, space: string, name: string, quoted: string | undefined, offset: number) => {
      if (quoted === undefined || !/^(?::|@|v-)/.test(name)) {
        return text;
      }
      const [quote] = quoted;
      const value = quoted.slice(1, -1);
      const slots = name === 'v-bind' ? readArgsSpread(value) : undefined;
      if (slots) {
        // Vue lets the later of an attribute and the spread win. The snippet cannot write an
        // attribute twice, so a set arg that overrides one written before the spread is unprintable.
        const after = writtenArgs(attributes.slice(offset + text.length));
        const overridden = writtenArgs(attributes.slice(0, offset)).find(
          (arg) => args[arg] !== undefined && !after.includes(arg) && !slots.includes(arg)
        );
        if (overridden !== undefined) {
          throw new UnprintableArgError(overridden);
        }
        return spreadAttributes(args, new Set([...slots, ...after]))
          .map((attribute) => space + attribute)
          .join('');
      }
      const arg = BINDING.test(name) ? wholeArg(value, args) : undefined;
      if (!arg) {
        const stringQuote = quote === '"' ? "'" : '"';
        const filled = fillCode(value, args, stringQuote, (code) => escapeInAttribute(code, quote));
        return `${space}${name}=${quote}${filled}${quote}`;
      }
      if (arg.value === undefined) {
        return '';
      }
      const prop = /^(?::|v-bind:)(.+)$/.exec(name)?.[1];
      return prop !== undefined && typeof arg.value === 'string'
        ? `${space}${prop}="${escapeInAttribute(arg.value)}"`
        : `${space}${name}="${printInAttribute(arg.value, arg.key)}"`;
    }
  );
}

// The args a tag passes with its own attributes, so its `v-bind="args"` leaves them out.
function writtenArgs(attributes: string): string[] {
  return [...attributes.matchAll(ATTRIBUTE)].flatMap(([, , attribute]) => {
    const [name] = attribute.split('.');
    const model = /^v-model(?::(.+))?$/.exec(name);
    if (model) {
      const prop = camelize(model[1] ?? 'modelValue');
      return [prop, `onUpdate:${prop}`];
    }
    const event = /^(?:@|v-on:)(.+)$/.exec(name)?.[1];
    if (event) {
      return [`on${event[0].toUpperCase()}${camelize(event.slice(1))}`];
    }
    const prop = /^(?::|v-bind:)?([^:@#]+)$/.exec(name)?.[1];
    return prop && !prop.startsWith('v-') ? [prop, camelize(prop)] : [];
  });
}

function spreadAttributes(args: Args, written: ReadonlySet<string>): string[] {
  return Object.entries(args).flatMap(([name, value]) => {
    if (value === undefined || written.has(name)) {
      return [];
    }
    if (typeof value === 'function' && /^on[A-Z]/.test(name)) {
      const handler = name.replace(/[:-](\w)/g, (_, char: string) => char.toUpperCase());
      return [`@${name[2].toLowerCase()}${name.slice(3)}="${handler}"`];
    }
    if (!/^[A-Za-z_][\w:-]*$/.test(name)) {
      throw new UnprintableArgError(name);
    }
    if (value === true) {
      return [name];
    }
    return typeof value === 'string'
      ? [`${name}="${escapeInAttribute(value)}"`]
      : [`:${name}="${printInAttribute(value, name)}"`];
  });
}

const printInAttribute = (value: unknown, name: string) =>
  escapeInAttribute(printValue(value, { ...PRINT_OPTIONS, quote: "'", name }));

// A VNode or a component has no source the browser can print.
const PRINT_OPTIONS: PrintValueOptions = {
  printCustom: (value, { name }) => {
    if (isVNode(value) || (value instanceof Object && ('setup' in value || 'render' in value))) {
      throw new UnprintableArgError(name ?? 'value');
    }
    return undefined;
  },
};
