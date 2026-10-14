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
// arg set to `undefined` too. `⟦value label⟧` is the value of a host field, for an arg the markup
// reads by name; its default word is printed while unset. Code over several lines continues at the
// indentation of the hole's line.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  const lines = [...template.matchAll(/⟦[^⟧]*⟧/g)].map(({ index }) =>
    template.slice(template.lastIndexOf('\n', index) + 1, index)
  );
  let holeIndex = 0;
  return fillHoles(template, (kind, words) => {
    const line = lines[holeIndex++]!;
    if (kind === 'value') {
      return continued(
        (args[words[0]!] === undefined && defaultCode(words[1])) ||
          printValue(args[words[0]!], words[0]!, { quote: "'" }),
        line
      );
    }
    const separator = line.trim() === '' ? `\n${line}` : ' ';
    const bindsUndefined = words[0] === BINDS_UNDEFINED;
    return (bindsUndefined ? words.slice(1) : words)
      .filter((name) => args[name] !== undefined || (bindsUndefined && name in args))
      .map((name) => escapeTemplateLiteral(continued(binding(name, args[name]), line)))
      .join(separator);
  });
};

// A template literal's own lines are part of its value, so code holding one keeps its lines.
const continued = (code: string, line: string) =>
  code.includes('`') ? code : code.replaceAll('\n', `\n${line.match(/^\s*/)![0]}`);

// A string is bound too, as the story binds it: a plain attribute would also land on the element,
// where `title`, `hidden` or a native host's `disabled` act on their own.
const binding = (name: string, value: unknown) =>
  `[${name}]="${escapeAttribute(printValue(value, name, { quote: "'", opaque: isNonFinite }))}"`;

// Only an `&` that starts an entity reads differently, as the static snippet escapes it.
const escapeAttribute = (text: string) =>
  text.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');

// An Angular template has no `NaN` or `Infinity`; it would read them as component fields.
const isNonFinite = (value: unknown) => typeof value === 'number' && !Number.isFinite(value);
