export const ADDON_ID = 'storybook/pseudo-states';
export const TOOL_ID = `${ADDON_ID}/tool`;
export const PARAM_KEY = 'pseudo';

// Regex patterns for pseudo-elements which are not allowed to have classes applied on them
// E.g. ::-webkit-scrollbar-thumb.pseudo-hover is not a valid selector
export const EXCLUDED_PSEUDO_ELEMENT_PATTERNS = ['::-(webkit|moz|ms)-[a-z-]+', '::part\\([^)]+\\)'];

/**
 * This lookbehind ensures we don't match escaped pseudo-states commonly used in Tailwind (e.g.
 * `.foo\:hover\:bar:hover`). We do this by skipping pseudo-states preceded by an odd number of `\`
 * escapes.
 *
 * @example
 *
 * Excluded:
 *
 * ```
 * .foo\:pseudo-selector {}
 * .foo\\\:pseudo-selector {}
 * ```
 *
 * Included:
 *
 * ```
 * .foo\\:pseudo-selector {}
 * .foo\\\\:pseudo-selector {}
 * ```
 */
export const EXCLUDED_PSEUDO_ESCAPE_SEQUENCE = '(?<=(?<!\\\\)(?:\\\\\\\\)*)';

// Dynamic pseudo-classes
// @see https://www.w3.org/TR/2018/REC-selectors-3-20181106/#dynamic-pseudos
export const PSEUDO_STATES = {
  hover: 'hover',
  active: 'active',
  focusVisible: 'focus-visible',
  focusWithin: 'focus-within',
  focus: 'focus', // must come after its alternatives
  visited: 'visited',
  link: 'link',
  target: 'target',
} as const;
