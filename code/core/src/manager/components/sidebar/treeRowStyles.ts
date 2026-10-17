import type { CSSObject } from 'storybook/theming';

/**
 * Show one icon at rest and another one while the row is active. Mark the resting icon with the
 * class `static-only` and the active icon with the class `hover-only`.
 *
 * @param activeSelectors The selectors that make a row active, for example `['&:hover']`.
 */
export const iconSwap = (activeSelectors: string[]): CSSObject => ({
  '.static-only': {
    display: 'flex',
    alignContent: 'center',
    alignItems: 'center',
  },
  '.hover-only': {
    display: 'none',
  },
  [activeSelectors.map((selector) => `${selector} .static-only`).join(', ')]: {
    display: 'none',
  },
  [activeSelectors.map((selector) => `${selector} .hover-only`).join(', ')]: {
    display: 'flex',
    alignContent: 'center',
    alignItems: 'center',
  },
});

/** A row label that owns the free space and truncates with an ellipsis instead of wrapping. */
export const truncatedLabel: CSSObject = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
