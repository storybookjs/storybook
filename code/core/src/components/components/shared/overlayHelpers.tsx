import React, { type ButtonHTMLAttributes, type ReactNode, forwardRef, useState } from 'react';

import type { DecoratorFunction } from 'storybook/internal/csf';

import { UNSAFE_PortalProvider } from '@react-aria/overlays';
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
interface TriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}
export const Trigger = forwardRef<HTMLButtonElement, TriggerProps>((props, ref) => (
  <button
    {...props}
    ref={ref}
    style={{
      width: 120,
      height: 50,
      margin: 10,
    }}
  />
));
Trigger.displayName = 'Trigger';

/**
 * Storybook decorator to help render PopoverProvider in stories. Internal to Storybook. Use at your
 * own risk.
 */
export const OverlayTriggerDecorator: DecoratorFunction = (Story, { args }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  return (
    <Container>
      <UNSAFE_PortalProvider getContainer={() => container}>
        <Story args={args} />
      </UNSAFE_PortalProvider>
      <div id="portal" ref={(element) => setContainer(element ?? null)}></div>
    </Container>
  );
};
