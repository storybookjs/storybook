import type { Decorator } from '@storybook/react';

import type { PositionProps } from '@react-types/overlays';
import memoize from 'memoizerific';
import { styled } from 'storybook/theming';

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

// Story helper
const Container = styled.div({
  width: 500,
  height: 500,
  paddingTop: 100,
  overflowY: 'scroll',
  background: '#eee',
  position: 'relative',
});

// Story helper
export const Trigger = styled.button({
  width: 120,
  height: 50,
  margin: 10,
  '&:focus-visible': {
    outline: '2px solid blue',
    outlineOffset: '2px',
  },
});

// Story helper
export const OverlayTriggerDecorator: Decorator = (storyFn) => <Container>{storyFn()}</Container>;
