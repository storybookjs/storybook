import {
  type FillSnippetTemplate,
  defaultCode,
  fillHoles,
  printValue,
} from 'storybook/internal/docs-tools';

import { BINDS_UNDEFINED, escapeTemplateLiteral } from '../../template-grammar.ts';

// Fills a template from the story-docs build. `⟦props label size⟧` is the inputs the story's args
// may bind, which lands in the host component's `template` literal; on a line of its own, it puts
// each binding on a line of its own, as the build lays out a long element. Led by `=`, it binds an
// arg set to `undefined` too. `⟦value label⟧` is the
// value of a host field, for an arg the markup reads by name; its default word is printed while
// unset.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  const separators = [...template.matchAll(/⟦[^⟧]*⟧/g)].map(({ index }) => {
    const line = template.slice(template.lastIndexOf('\n', index) + 1, index);
    return line.trim() === '' ? `\n${line}` : ' ';
  });
  let holeIndex = 0;
  return fillHoles(template, (kind, words) => {
    const separator = separators[holeIndex++]!;
    if (kind === 'value') {
      return (
        (args[words[0]!] === undefined && defaultCode(words[1])) ||
        printValue(args[words[0]!], words[0]!, { quote: "'" })
      );
    }
    const bindsUndefined = words[0] === BINDS_UNDEFINED;
    return (bindsUndefined ? words.slice(1) : words)
      .filter((name) => args[name] !== undefined || (bindsUndefined && name in args))
      .map((name) => escapeTemplateLiteral(binding(name, args[name])))
      .join(separator);
  });
};

// A string is bound too, as the story binds it: a plain attribute would also land on the element,
// where `title`, `hidden` or a native host's `disabled` act on their own.
const binding = (name: string, value: unknown) =>
  `[${name}]="${escapeAttribute(printValue(value, name, { quote: "'", opaque: isNonFinite }))}"`;

// Only an `&` that starts an entity reads differently, as the static snippet escapes it.
const escapeAttribute = (text: string) =>
  text.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');

// An Angular template has no `NaN` or `Infinity`; it would read them as component fields.
const isNonFinite = (value: unknown) => typeof value === 'number' && !Number.isFinite(value);
