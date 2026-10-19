import {
  type FillSnippetTemplate,
  asOperand,
  defaultCode,
  fillHoles,
  printValue,
} from 'storybook/internal/docs-tools';

import { BINDS_UNDEFINED, escapeTemplateLiteral } from '../../template-grammar.ts';

// Fills a template from the story-docs build. `⟦props label size⟧` is the inputs the story's args
// may bind, which lands in the host component's `template` literal; on a line of its own, it puts
// each binding on a line of its own, as the build lays out a long element. Led by `=`, it binds an
// arg set to `undefined` too. `⟦value label⟧` is an arg in a host field's code, such as the field's
// value for an arg the markup reads by name, and `⟦operand label⟧` one the code reads on; a default
// word is printed while the arg is unset. Code over several lines continues at the indentation of
// the hole's line. `⟦text label⟧` is an arg the story's markup interpolates, as the text it renders:
// a string as itself, any other value as it prints in code, with the `{`, `}` and `@` Angular would
// read as its own syntax escaped as Angular escapes them.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  const lines = [...template.matchAll(/⟦[^⟧]*⟧/g)].map(({ index }) =>
    template.slice(template.lastIndexOf('\n', index) + 1, index)
  );
  let holeIndex = 0;
  return fillHoles(template, (kind, words) => {
    const line = lines[holeIndex++]!;
    if (kind === 'value' || kind === 'operand') {
      const [arg, word] = words as [string, string?];
      const printed =
        (args[arg] === undefined && defaultCode(word)) ||
        printValue(args[arg], arg, { quote: "'" });
      return continued(kind === 'operand' ? asOperand(printed) : printed, line);
    }
    if (kind === 'text') {
      const value = args[words[0]!];
      const text = typeof value === 'string' ? value : printValue(value, words[0]!, { quote: "'" });
      return escapeTemplateLiteral(text.replace(/[{}@]/g, (char) => TEXT_ESCAPES[char]!));
    }
    const separator = line.trim() === '' ? `\n${line}` : ' ';
    const bindsUndefined = words[0] === BINDS_UNDEFINED;
    return (bindsUndefined ? words.slice(1) : words)
      .filter((name) => args[name] !== undefined || (bindsUndefined && name in args))
      .map((name) => escapeTemplateLiteral(continued(binding(name, args[name]), line)))
      .join(separator);
  });
};

const TEXT_ESCAPES: Record<string, string> = { '{': "{{ '{' }}", '}': "{{ '}' }}", '@': '&#64;' };

const continued = (code: string, line: string) =>
  code.replaceAll('\n', `\n${line.match(/^\s*/)![0]}`);

// A string is bound too, as the story binds it: a plain attribute would also land on the element,
// where `title`, `hidden` or a native host's `disabled` act on their own.
const binding = (name: string, value: unknown) =>
  `[${name}]="${escapeAttribute(printValue(value, name, { quote: "'", opaque: isNonFinite }))}"`;

// Only an `&` that starts an entity reads differently, as the static snippet escapes it.
const escapeAttribute = (text: string) =>
  text.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');

// An Angular template has no `NaN` or `Infinity`; it would read them as component fields.
const isNonFinite = (value: unknown) => typeof value === 'number' && !Number.isFinite(value);
