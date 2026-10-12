// A live snippet `template` is the static snippet's html with lit-style holes, which
// `fillTemplate` fills with the args. `\` escapes the next character. A hole is `${…}`:
//   name=${args.x}             `name="value"`, `name=""` when unset
//   name=${ifDefined(args.x)}  the attribute, left out when unset
//   ?name=${args.x}            `name` when truthy
//   .name=${args.x}            a property binding, with the value printed
//   @name=${args.x}            a listener binding, with the handler named after the arg
//   name="a ${args.x}"         the value written into the quoted attribute
//   ${...args/* {…} */}        the listed args as attributes, see `spreadHole`
//   ${args.x}                  text; `${unsafeHTML(args.x)}` as html
//   ${args.x ? a : b}          the branch the arg picks, filled as that hole
//   ${expression}              its arg paths filled, the rest kept

export const MAX_LINE = 80;

export const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export const escapeText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const escapeTemplateText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\$\{/g, '\\${');

// `viaField`: an empty string still prints `name=""`.
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

export const printCssProperties = (
  properties: { name: string; value: unknown }[]
): string | undefined => {
  const declarations = properties
    .filter(({ value }) => value !== null && value !== undefined && value !== '')
    .map(({ name, value }) => `${name}: ${String(value)};`);
  return declarations.length === 0 ? undefined : declarations.join(' ');
};

export type SpreadBinding =
  // `defaultsToTrue`: `false` prints as `?name=${false}`, as HTML has no attribute for it.
  | { kind: 'attribute'; name: string; reflected: boolean; defaultsToTrue: boolean }
  | { kind: 'property'; name: string }
  | { kind: 'style'; name: string }
  // A slot, CSS part or state: shown outside the tag, so the filler throws when it is set.
  | { kind: 'unfillable' };

// Encodes each binding as its name with a sigil: `.name` a property, `--name` a custom property,
// `""` unfillable, otherwise an attribute, after `?` when it defaults to true and `=` when reflected.
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
