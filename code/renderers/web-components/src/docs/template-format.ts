// A live snippet `template` is the static snippet's html with lit-style holes where it shows arg
// values; the story-docs provider writes it and `fillTemplate` fills it in the preview. `\` escapes
// the next character, and a hole is `${…}`:
//   name=${args.x}             lit's attribute: `name="value"`, `name=""` when unset
//   name=${ifDefined(args.x)}  the attribute, left out when unset
//   ?name=${args.x}            `name` when truthy, left out otherwise
//   .name=${args.x}            a property binding, kept with the value printed
//   @name=${args.x}            a listener binding, kept with the handler named after the arg
//   name="a ${args.x}"         a value written into the quoted attribute
//   ${...args/* {…} */}        the listed args as attributes, see `spreadHole`
//   ${args.x}                  text; `${unsafeHTML(args.x)}` as html
//   ${args.x ? a : b}          the branch the arg picks, filled as that hole: an arg path, a
//                              literal, `nothing`, an html`…` template or code
//   ${expression}              any other expression: its arg paths filled, the rest kept

// The widest line the snippet keeps an element or start tag on.
export const MAX_LINE = 80;

export const escapeAttribute = (value: string, quote: '"' | "'" = '"') => {
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return quote === "'" ? escaped.replace(/'/g, '&#39;') : escaped.replace(/"/g, '&quot;');
};

export const escapeText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const escapeTemplateText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\$\{/g, '\\${');

// As the static snippet prints an arg set as an attribute; `viaField` keeps an empty string.
export function printAttribute({
  name,
  value,
  viaField,
}: {
  name: string;
  value: unknown;
  viaField?: boolean;
}): string | undefined {
  if (value === true) {
    return name;
  }
  if (value === '') {
    return viaField ? `${name}=""` : undefined;
  }
  if (value === false || value === null || value === undefined) {
    return undefined;
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `${name}="${escapeAttribute(text)}"`;
}

// The `style` declarations of the custom properties that are set.
export const printCssProperties = (
  properties: { name: string; value: unknown }[]
): string | undefined => {
  const declarations = properties
    .filter(({ value }) => value !== null && value !== undefined && value !== '')
    .map(({ name, value }) => `${name}: ${String(value)};`);
  return declarations.length === 0 ? undefined : declarations.join(' ');
};

export type SpreadBinding =
  // `reflected`: set through a field, so an empty string still prints `name=""`.
  // `defaultsToTrue`: `false` prints as `?name=${false}`, as HTML has no attribute for it.
  | { kind: 'attribute'; name: string; reflected: boolean; defaultsToTrue: boolean }
  | { kind: 'property'; name: string }
  | { kind: 'style'; name: string }
  // A slot, CSS part or state, which the snippet shows outside the tag; the filler throws when set.
  | { kind: 'unfillable' };

// The map in the comment encodes each binding as its name with sigils: `.name` a property,
// `--name` a custom property in `style`, `""` an unfillable arg, otherwise an attribute, after
// `?` when it defaults to true and `=` when it is reflected.
export const spreadHole = (bindings: ReadonlyMap<string, SpreadBinding>) => {
  const encoded = Object.fromEntries([...bindings].map(([arg, binding]) => [arg, encode(binding)]));
  return `\${...args/* ${JSON.stringify(encoded).replaceAll('*/', '*\\/')} */}`;
};

export const parseSpread = (expression: string): Map<string, SpreadBinding> | undefined => {
  const map = /^\.\.\.args\s*\/\*([\s\S]*)\*\/$/.exec(expression)?.[1];
  if (map === undefined) {
    return undefined;
  }
  const encoded: Record<string, string> = JSON.parse(map);
  return new Map(Object.entries(encoded).map(([arg, binding]) => [arg, decode(binding)]));
};

const encode = (binding: SpreadBinding) => {
  switch (binding.kind) {
    case 'property':
      return `.${binding.name}`;
    case 'style':
      return binding.name;
    case 'unfillable':
      return '';
    case 'attribute':
      return `${binding.defaultsToTrue ? '?' : ''}${binding.reflected ? '=' : ''}${binding.name}`;
  }
};

const decode = (encoded: string): SpreadBinding => {
  if (encoded === '') {
    return { kind: 'unfillable' };
  }
  if (encoded.startsWith('.')) {
    return { kind: 'property', name: encoded.slice(1) };
  }
  if (encoded.startsWith('--')) {
    return { kind: 'style', name: encoded };
  }
  const [, defaultsToTrue, reflected, name] = /^(\??)(=?)(.*)$/s.exec(encoded)!;
  return {
    kind: 'attribute',
    name: name!,
    reflected: !!reflected,
    defaultsToTrue: !!defaultsToTrue,
  };
};
