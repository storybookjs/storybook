import {
  ARG_PATH_PATTERN,
  type FillSnippetTemplate,
  type PrintValueOptions,
  printArgPath,
  printValue,
  resolveArgPath,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { OMIT_COMMENT, isJsxAttributeName } from './template-format.ts';

const childrenHole = (tagGroup: string) =>
  String.raw`\{\s*args\.children\s*\}<\/(?<${tagGroup}>[\w.:-]+)>`;

// `{...args}` with its omit comment, and the tag's closer and `{args.children}` when they follow.
const SPREAD_HOLE = String.raw`(?<spreadSpace>[ \t]*\n[ \t]*| ?)\{\.\.\.(?<spread>${ARG_PATH_PATTERN}|args)\s*(?:${OMIT_COMMENT}\s*)?\}(?<closer> ?\/?>)?(?:(?<=>)${childrenHole('spreadTag')})?`;
// `>{args.children}</Tag>` after the attributes written next to a spread; the `>` must end the
// opening tag, not a sibling's `<Icon />` or `</h1>`.
const CHILDREN_HOLE = String.raw`(?<!\/|<\/[\w.:-]*)>${childrenHole('childrenTag')}`;
// `name={args.x}` with the space before it, so an unset arg leaves the whole attribute out.
const ATTRIBUTE_HOLE = String.raw`(?<attributeSpace>[ \t]*\n[ \t]*|[ \t]+)(?<attribute>[A-Za-z_][\w:-]*)=\{\s*(?<attributeValue>${ARG_PATH_PATTERN})\s*\}`;
// `{args.x}` as a child.
const CHILD_HOLE = String.raw`(?<![=$])\{\s*(?<child>${ARG_PATH_PATTERN})\s*\}`;
const EXPRESSION_HOLE = `(?<expression>${ARG_PATH_PATTERN})`;

// One pass, so a filled-in value is never read as a template again.
const TEMPLATE_HOLE = new RegExp(
  [SPREAD_HOLE, CHILDREN_HOLE, ATTRIBUTE_HOLE, CHILD_HOLE, EXPRESSION_HOLE].join('|'),
  'g'
);

type Groups = Partial<Record<string, string>>;

// Fills a template from `buildStoryTemplate` with the current args, keeping the story's structure:
// `args.loading ? <Spinner /> : …` becomes `true ? <Spinner /> : …`.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  template.replace(TEMPLATE_HOLE, (...match) => {
    const [offset, , groups] = match.slice(-3) as [number, string, Groups];
    if (groups.spread !== undefined) {
      return fillSpread(template, offset, groups, args);
    }
    if (groups.childrenTag !== undefined) {
      const { closer, rest } = closeElement(groups.childrenTag, args);
      const atLineStart = /\n[ \t]*$/.test(template.slice(0, offset));
      return (atLineStart ? closer.trim() : closer) + rest;
    }
    if (groups.attribute !== undefined) {
      return fillAttribute(groups.attributeSpace!, groups.attribute, groups.attributeValue!, args);
    }
    if (groups.child !== undefined) {
      const { value, rest, key } = resolveArgPath(groups.child, args);
      return rest ? `{${printArgPath(groups.child, args, PRINT_OPTIONS)}}` : toChildren(value, key);
    }
    return printArgPath(groups.expression!, args, PRINT_OPTIONS);
  });

function fillSpread(template: string, offset: number, groups: Groups, args: Args) {
  const path = groups.spread!;
  const { value, rest } = resolveArgPath(path, args);
  const omitted = new Set(groups.omit?.split(',').map((name) => name.trim()));
  // The element spreading `args` writes its children itself, or as `{args.children}`.
  if (path === 'args') {
    omitted.add('children');
  }
  const unset = !rest && (value === undefined || value === null);
  const props = unset
    ? []
    : isRecord(value) && !rest
      ? toProps(value, omitted)
      : [`{...${printArgPath(path, args, PRINT_OPTIONS)}}`];

  const { closer, rest: after } =
    groups.spreadTag === undefined
      ? { closer: groups.closer ?? '', rest: '' }
      : closeElement(groups.spreadTag, args);

  const space = groups.spreadSpace!;
  if (space.includes('\n')) {
    return props.map((prop) => `${space}${prop}`).join('') + closer + after;
  }
  return layoutAttributes(props, template, offset, closer) + after;
}

function fillAttribute(space: string, name: string, path: string, args: Args) {
  const { value, rest } = resolveArgPath(path, args);
  if (rest) {
    return `${space}${name}={${printArgPath(path, args, PRINT_OPTIONS)}}`;
  }
  const prop = toProp(name, value);
  return prop === undefined ? '' : `${space}${prop}`;
}

// The end of an element whose children are `{args.children}`: ` />` when there are none.
function closeElement(tag: string, args: Args): { closer: string; rest: string } {
  const children = toChildren(args.children, 'children');
  return children === ''
    ? { closer: ' />', rest: '' }
    : { closer: '>', rest: `${children}</${tag}>` };
}

function toProps(values: Record<string, unknown>, omitted: ReadonlySet<string>): string[] {
  const props: string[] = [];
  const invalid: [string, unknown][] = [];
  for (const [name, value] of Object.entries(values)) {
    if (omitted.has(name)) {
      continue;
    }
    if (!isJsxAttributeName(name)) {
      if (value !== undefined) {
        invalid.push([name, value]);
      }
      continue;
    }
    const prop = toProp(name, value);
    if (prop !== undefined) {
      props.push(prop);
    }
  }
  if (invalid.length > 0) {
    props.push(`{...${printValue(Object.fromEntries(invalid), PRINT_OPTIONS)}}`);
  }
  return props;
}

function toProp(name: string, value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value === true) {
    return name;
  }
  if (typeof value === 'string' && !/["\n]|&[#\w]+;/.test(value)) {
    return `${name}="${value}"`;
  }
  return `${name}={${printValue(value, { ...PRINT_OPTIONS, name })}}`;
}

function toChildren(value: unknown, name: string): string {
  if (value === undefined || value === null || typeof value === 'boolean' || value === '') {
    return '';
  }
  if (isPlainText(value) || typeof value === 'number') {
    return String(value);
  }
  if (isElement(value)) {
    return printElement(value);
  }
  if (Array.isArray(value) && value.every((item) => isPlainText(item) || isElement(item))) {
    return value.map((item) => toChildren(item, name)).join('');
  }
  return `{${printValue(value, { ...PRINT_OPTIONS, name })}}`;
}

// JSX collapses line breaks in text, and decodes entities such as `&amp;` in text and attributes.
const isPlainText = (value: unknown): value is string =>
  typeof value === 'string' && !/[{}<>\r\n]|&[#\w]+;/.test(value);

const PRINT_OPTIONS: PrintValueOptions = {
  printCustom: (value) => (isElement(value) ? printElement(value) : undefined),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !isElement(value);

interface ElementLike {
  type: unknown;
  props?: Record<string, unknown>;
}

const ELEMENT_TYPES = [Symbol.for('react.element'), Symbol.for('react.transitional.element')];

const isElement = (value: unknown): value is ElementLike =>
  typeof value === 'object' &&
  value !== null &&
  ELEMENT_TYPES.includes((value as { $$typeof?: symbol }).$$typeof!);

function printElement(element: ElementLike): string {
  const name = elementName(element.type);
  const { children, ...props } = element.props ?? {};
  const attributes = toProps(props, new Set())
    .map((prop) => ` ${prop}`)
    .join('');
  const content = toChildren(children, 'children');
  if (name === '') {
    return `<>${content}</>`;
  }
  return content === '' ? `<${name}${attributes} />` : `<${name}${attributes}>${content}</${name}>`;
}

function elementName(type: unknown): string {
  if (typeof type === 'string') {
    return type;
  }
  if (type === Symbol.for('react.fragment')) {
    return '';
  }
  const named = (candidate: unknown) => {
    const { displayName, name } = (candidate ?? {}) as { displayName?: unknown; name?: unknown };
    const found = typeof displayName === 'string' ? displayName : name;
    return typeof found === 'string' && found !== '' ? found : undefined;
  };
  // `memo` and `forwardRef` wrap the component they name in `type` and `render`.
  const wrapper = (type ?? {}) as { type?: unknown; render?: unknown };
  return named(type) ?? named(wrapper.type) ?? named(wrapper.render) ?? 'Component';
}

// The indentation of the line `offset` is on.
function lineIndent(code: string, offset: number): string {
  const lineStart = code.lastIndexOf('\n', offset - 1) + 1;
  return /^[ \t]*/.exec(code.slice(lineStart))![0];
}

const MAX_INLINE_ATTRIBUTES_LENGTH = 50;

// Lays out attributes written in place of an args spread: on the same line when short, otherwise
// one per line, indented one level deeper than the element on the line at `offset`. `closer` is
// the tag's `>` or `/>` when it directly follows the spread, and then goes on its own line.
function layoutAttributes(
  attributes: readonly string[],
  code: string,
  offset: number,
  closer = ''
): string {
  if (attributes.join(' ').length <= MAX_INLINE_ATTRIBUTES_LENGTH) {
    return attributes.map((attribute) => ` ${attribute}`).join('') + closer;
  }
  const indent = lineIndent(code, offset);
  const lines = attributes.map((attribute) => `\n${indent}  ${attribute}`).join('');
  return closer ? `${lines}\n${indent}${closer.trim()}` : `${lines}\n${indent} `;
}
