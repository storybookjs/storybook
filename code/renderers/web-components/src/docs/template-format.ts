// A live snippet `template` is the story's lit html as written, with every arg it reads written as
// `args.name`; `\` escapes the next character. A story without a render function gets
// `<tag ${...args/* {…} */}>`, which spreads the args as the attribute, `.property` or
// `--custom-property` the manifest maps each to, or `null` for one only the static snippet shows.

export const escapeTemplateText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\$\{/g, '\\${');

export const spreadHole = (bindings: Record<string, string | null>) =>
  `\${...args/* ${JSON.stringify(bindings).replaceAll('*/', '*\\/')} */}`;

export const parseSpread = (expression: string): Record<string, string | null> | undefined => {
  const bindings = /^\.\.\.args\s*\/\*([\s\S]*)\*\/$/.exec(expression)?.[1];
  return bindings === undefined ? undefined : JSON.parse(bindings);
};
