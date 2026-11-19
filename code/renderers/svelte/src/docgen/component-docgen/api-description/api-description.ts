import ts from 'typescript';

import { type Docgen, type PropInfo, UNPRINTABLE_DEFAULT } from '../svelte2tsx/generate-docgen.ts';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

// In Svelte 5 callbacks, snippets and bindable props are all props, so one `Props` type holds them,
// as the component declares it.
export function buildApiDescription(name: string, docgen: Docgen): string | undefined {
  const { props, events = [], slots = [], omittedTypes = [] } = docgen;
  if (!props.length && !omittedTypes.length && !events.length && !slots.length) {
    return undefined;
  }

  const sanitizedName = name.replace(/\W+/g, '');
  const typePrefix = IDENTIFIER.test(sanitizedName) ? sanitizedName : `Component${sanitizedName}`;
  const parts: string[] = [];

  if (props.length > 0 || omittedTypes.length > 0) {
    parts.push(
      ...section(
        'Props',
        typePrefix,
        docgen.typeParams,
        props.flatMap((prop) => propLines(prop)),
        // The props of `HTMLInputAttributes` and the like are too many to list one by one.
        { extendsTypes: omittedTypes }
      )
    );
  }

  // Svelte 4 components dispatch events with `createEventDispatcher` and render `<slot>`s.
  if (events.length > 0) {
    parts.push(
      ...section(
        'Events',
        typePrefix,
        docgen.typeParams,
        events.flatMap((event) => [
          ...docComment(event),
          `${memberKey(event.name)}: ${event.typeText ?? 'CustomEvent'}; // on:${event.name}`,
        ])
      )
    );
  }

  if (slots.length > 0) {
    parts.push(
      ...section(
        'Slots',
        typePrefix,
        docgen.typeParams,
        slots.flatMap((slot) => [
          ...docComment(slot),
          `${memberKey(slot.name)}: ${slot.typeText ?? '{}'};`,
        ]),
        { intro: 'Each slot is typed with the props it passes to its content.' }
      )
    );
  }

  return parts.join('\n').trim();
}

function memberKey(name: string): string {
  return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

// An optional prop's type reads `T | undefined`; the `?` already says that.
function propType(prop: PropInfo): string {
  const text = prop.typeText ?? 'unknown';
  return prop.optional ? unwrapParens(text.replace(/ \| undefined$/, '')) : text;
}

// `((e: MouseEvent) => void) | undefined` leaves `((e: MouseEvent) => void)` once `undefined` goes.
function unwrapParens(text: string): string {
  if (!text.startsWith('(') || !text.endsWith(')')) {
    return text;
  }
  let depth = 0;
  for (let index = 0; index < text.length - 1; index++) {
    depth += text[index] === '(' ? 1 : text[index] === ')' ? -1 : 0;
    if (depth === 0) {
      return text;
    }
  }
  return text.slice(1, -1);
}

// The extracted default wins over an authored `@default`, as in the props table.
function propLines(prop: PropInfo): string[] {
  const bindable = prop.jsDocTags?.some((tag) => tag.name === 'bindable');
  const marker = bindable ? ` // bind:${prop.name}={...}` : '';
  const extracted = prop.defaultValue?.text;
  // The extractor's placeholder for a default it cannot print wins over `@default` too, and prints
  // nothing.
  const defaultValue =
    extracted === undefined
      ? prop.jsDocTags?.find((tag) => tag.name === 'default')?.text
      : extracted === UNPRINTABLE_DEFAULT
        ? undefined
        : withoutComments(extracted);
  // An array or object default can span several lines.
  const defaultText = defaultValue ? ` = ${defaultValue.replace(/\s*\n\s*/g, ' ')}` : '';
  return [
    ...docComment(prop),
    `${memberKey(prop.name)}${prop.optional ? '?' : ''}: ${propType(prop)}${defaultText};${marker}`,
  ];
}

// A `//` comment in a multi-line array or object default would swallow the rest of the joined line.
function withoutComments(code: string): string {
  if (!code.includes('//')) {
    return code;
  }
  const file = ts.createSourceFile('default.ts', `(${code})`, ts.ScriptTarget.Latest, true);
  const [statement] = file.statements;
  if (
    file.statements.length !== 1 ||
    !ts.isExpressionStatement(statement) ||
    !ts.isParenthesizedExpression(statement.expression)
  ) {
    return code;
  }
  return ts
    .createPrinter({ removeComments: true })
    .printNode(ts.EmitHint.Expression, statement.expression.expression, file);
}

function docComment(member: PropInfo): string[] {
  const description = member.description?.trim() ?? '';
  // The member line already shows a JS component's `@type`, the default, and the `bindable` tag the
  // extractor adds for `$bindable()`.
  const tags = (member.jsDocTags ?? []).filter(
    (tag) => !['type', 'default', 'bindable'].includes(tag.name)
  );
  const tagLines = tags.map((tag) => `@${tag.name}${tag.text ? ` ${tag.text}` : ''}`);
  // An `@example` often spans several lines.
  const tagBody = tagLines.flatMap((tag) => tag.split('\n'));

  if (!description && tagLines.length === 0) {
    return [];
  }
  if (!description && tagBody.length === 1) {
    return [`/** ${tagLines[0]} */`];
  }
  if (!description.includes('\n') && tagLines.length === 0) {
    return [`/** ${description} */`];
  }

  return [
    '/**',
    ...(description ? description.split('\n').map(commentLine) : []),
    ...(tagLines.length ? [...(description ? [' *'] : []), ...tagBody.map(commentLine)] : []),
    ' */',
  ];
}

function commentLine(line: string): string {
  return line.trim() ? ` * ${line}` : ' *';
}

function section(
  kind: 'Props' | 'Events' | 'Slots',
  typePrefix: string,
  typeParams: string | undefined,
  lines: string[],
  { intro, extendsTypes = [] }: { intro?: string; extendsTypes?: string[] } = {}
): string[] {
  const alias = `export type ${typePrefix}${kind}${typeParams ? `<${typeParams}>` : ''} =`;
  const extendsText = extendsTypes.join(' & ');
  return [
    `## ${kind}`,
    '',
    ...(intro ? [intro, ''] : []),
    '```',
    ...(lines.length
      ? [
          `${alias} {`,
          ...lines.map((line) => `  ${line}`),
          extendsText ? `} & ${extendsText}` : '}',
        ]
      : [`${alias} ${extendsText}`]),
    '```',
    '',
  ];
}
