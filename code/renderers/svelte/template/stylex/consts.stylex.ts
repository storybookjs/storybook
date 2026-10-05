import * as stylex from '@stylexjs/stylex';

export const spacing = stylex.defineConsts({
  gap: '12px',
});

export const breakpoints = stylex.defineConsts({
  // Narrower than any test viewport; stories still check `matchMedia` instead of assuming it
  wide: '@media (min-width: 320px)',
});
