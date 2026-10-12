// The parts of a React story-docs template that `buildStoryTemplate` writes on the server and
// `fillTemplate` reads in the preview.

export const isJsxAttributeName = (name: string) => /^[A-Za-z_][\w:-]*$/.test(name);

// The comment naming the props written after `{...args`, which the filled spread leaves out:
// `{...args/* omit: onClick, variant */}`.
export const omitComment = (names: readonly string[]) => ` omit: ${names.join(', ')} `;

export const OMIT_COMMENT = String.raw`\/\*\s*omit:(?<omit>[^*]*)\*\/`;
