// The parts of a React story-docs template that `buildStoryTemplate` writes on the server and
// `fillTemplate` reads in the preview.

/** Whether JSX can write `name` as an attribute; other props go in a spread object. */
export const isJsxAttributeName = (name: string) => /^[A-Za-z_][\w:-]*$/.test(name);

/**
 * The comment after `{...args` naming the props the element writes after the spread, which the
 * filled spread leaves out: `{...args/* omit: onClick, variant *\/}`.
 */
export const omitComment = (names: readonly string[]) => ` omit: ${names.join(', ')} `;

/** Reads an {@link omitComment}, with the names in the `omit` group. */
export const OMIT_COMMENT = String.raw`\/\*\s*omit:(?<omit>[^*]*)\*\/`;
