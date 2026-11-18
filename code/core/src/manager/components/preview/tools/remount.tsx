import type { ComponentProps } from 'react';
import React, { useEffect, useState } from 'react';

import { Button } from 'storybook/internal/components';
import { FORCE_REMOUNT } from 'storybook/internal/core-events';
import type { Addon_BaseType } from 'storybook/internal/types';

import { SyncIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';
import { styled } from 'storybook/theming/emotion';

interface AnimatedButtonProps {
  animating?: boolean;
}

const StyledAnimatedButton = styled(Button)<
  AnimatedButtonProps & Pick<ComponentProps<typeof Button>, 'disabled'>
>(({ theme, animating, disabled }) => ({
  opacity: disabled ? 0.5 : 1,
  svg: {
    animation: animating ? `${theme.animation.rotate360} 1000ms ease-out` : undefined,
  },
}));

// Only values, so the consumer re-renders the button when one of them changes and not on
// every store commit.
const menuMapper = ({ api, state }: Combo) => ({
  storyId: state.storyId,
  api,
});

export const remountTool: Addon_BaseType = {
  title: 'remount',
  id: 'remount',
  type: types.TOOL,
  match: ({ viewMode }) => viewMode === 'story',
  render: () => (
    <Consumer filter={menuMapper}>
      {({ storyId, api }) => {
        const [isAnimating, setIsAnimating] = useState(false);
        const remountComponent = () => {
          if (!storyId) {
            return;
          }
          api.emit(FORCE_REMOUNT, { storyId });
        };

        useEffect(() => {
          const handler = () => setIsAnimating(true);
          api.on(FORCE_REMOUNT, handler);
          return () => api.off?.(FORCE_REMOUNT, handler);
        }, [api]);

        return (
          <StyledAnimatedButton
            key="remount"
            padding="small"
            variant="ghost"
            ariaLabel="Reload story"
            onClick={remountComponent}
            onAnimationEnd={() => setIsAnimating(false)}
            animating={isAnimating}
            disabled={!storyId}
          >
            <SyncIcon />
          </StyledAnimatedButton>
        );
      }}
    </Consumer>
  ),
};
