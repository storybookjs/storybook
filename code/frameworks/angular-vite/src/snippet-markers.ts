// The markers a story-docs template holds where args go, written by the story-docs provider and read
// by the preview filler. `{{@` keeps each one from reading as Angular interpolation.
//
// - `{{@element sb-button | label [formatter] (pressed)}}`: the element the component's selector
//   renders, laid out as the static snippet lays it out.
// - `{{@bindings label (pressed)}}`: what `argsToTemplate` expands to in a story's own markup, which
//   is then laid out like the static snippet's markup.
// - `{{@args.label}}`: the arg as text inside the template, as a TypeScript value outside it.
// - `{{@handler pressed}}`: the host class's handler for an output the bindings bind.
//
// A binding list names an input filled from its arg (`label`), an input bound to the host field
// that holds its arg (`[formatter]`) and an output (`(pressed)`). The element binds every output it
// lists, like the static snippet; the bindings bind one while its arg holds a function, like
// `argsToTemplate`.

export const MARKER_PREFIX = '{{@';

const NAME = String.raw`[\w$-]+`;

export const isMarkerName = (name: string) => new RegExp(`^${NAME}$`).test(name);

export const canMarkSelector = (selector: string) => !/[|{}]/.test(selector);

export interface TemplateItem {
  kind: 'input' | 'field' | 'output';
  name: string;
}

const formatItem = ({ kind, name }: TemplateItem) =>
  kind === 'field' ? `[${name}]` : kind === 'output' ? `(${name})` : name;

const ITEM = new RegExp(
  String.raw`^(?:\[(?<field>${NAME})\]|\((?<output>${NAME})\)|(?<input>${NAME}))$`
);

const parseItem = (text: string): TemplateItem => {
  const { field, output, input } = ITEM.exec(text)!.groups!;
  return field !== undefined
    ? { kind: 'field', name: field }
    : output !== undefined
      ? { kind: 'output', name: output }
      : { kind: 'input', name: input! };
};

export const parseItems = (list: string): TemplateItem[] =>
  list
    .split(' ')
    .filter((text) => text !== '')
    .map(parseItem);

const itemList = (items: readonly TemplateItem[]) =>
  items.map((item) => ` ${formatItem(item)}`).join('');

export const argMarker = (name: string) => `{{@args.${name}}}`;

export const bindingsMarker = (items: readonly TemplateItem[]) => `{{@bindings${itemList(items)}}}`;

export const elementMarker = (selector: string, items: readonly TemplateItem[]) =>
  `{{@element ${selector} |${itemList(items)}}}`;

export const handlerMarker = (name: string) => `{{@handler ${name}}}`;

export const MARKUP_MARKER = new RegExp(
  [
    String.raw`\{\{@element (?<selector>[^|{}]+) \|(?<elementItems>[^{}]*)\}\}`,
    String.raw`(?<space>\s*)\{\{@bindings(?<bindingItems>[^{}]*)\}\}`,
    String.raw`\{\{@args\.(?<text>${NAME})\}\}`,
  ].join('|'),
  'g'
);

export const FIELD_MARKER = new RegExp(String.raw`\{\{@args\.(${NAME})\}\}`, 'g');

// A handler is a line of its own in the class body, which goes when its output is left unbound.
export const HANDLER_MARKER = new RegExp(String.raw`\n {2}\{\{@handler (${NAME})\}\}`, 'g');
