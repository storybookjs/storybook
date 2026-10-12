// A live snippet `template` is the story's lit html as written, with every arg it reads written as
// `args.name`; `\` escapes the next character. A story without a render function gets
// `<tag ${...args/* {…} */}>`, which spreads each arg as what the manifest maps it to: an
// `attribute`, a `.property`, an attribute backed by a field as `.field=attribute`, a
// `--custom-property`, or `null` for one only the static snippet shows.

export const escapeTemplateText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\$\{/g, '\\${');

export const spreadHole = (bindings: Record<string, string | null>) =>
  `\${...args/* ${JSON.stringify(bindings).replaceAll('*/', '*\\/')} */}`;

export const parseSpread = (expression: string): Record<string, string | null> | undefined => {
  const bindings = /^\.\.\.args\s*\/\*([\s\S]*)\*\/$/.exec(expression)?.[1];
  return bindings === undefined ? undefined : JSON.parse(bindings);
};
