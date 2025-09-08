import type { PositionProps } from '@react-types/overlays';
import memoize from 'memoizerific';

type BasicPlacement = 'top' | 'bottom' | 'left' | 'right';

type PlacementWithModifier =
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'left-start'
  | 'left-end'
  | 'right-start'
  | 'right-end';

export type PopperPlacement = BasicPlacement | PlacementWithModifier;

export const convertToReactAriaPlacement = memoize(1000)((
  p: PopperPlacement
): NonNullable<PositionProps['placement']> => {
  if (p === 'left-end') {
    return 'left bottom';
  }

  if (p === 'right-end') {
    return 'right bottom';
  }

  if (p === 'left-start') {
    return 'left top';
  }

  if (p === 'right-start') {
    return 'right top';
  }

  return p.replace('-', ' ') as NonNullable<PositionProps['placement']>;
});
