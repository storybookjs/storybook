import type { ComponentProps } from 'react';
import React, { useState } from 'react';
import { IconButton } from '@storybook/core/components';
import { Consumer, types } from '@storybook/core/manager-api';
import type { Combo } from '@storybook/core/manager-api';
import { styled } from '@storybook/core/theming';
import { FORCE_REMOUNT } from '@storybook/core/core-events';
import type { Addon_BaseType } from '@storybook/core/types';
import { SyncIcon } from '@storybook/icons';

interface AnimatedButtonProps {
  animating?: boolean;
}

const StyledAnimatedIconButton = styled(IconButton)<
  AnimatedButtonProps & Pick<ComponentProps<typeof IconButton>, 'disabled'>
>(({ theme, animating, disabled }) => ({
  opacity: disabled ? 0.5 : 1,
  svg: {
    animation: animating ? `${theme.animation.rotate360} 1000ms ease-out` : undefined,
  },
}));

const menuMapper = ({ api, state }: Combo) => {
  const { storyId } = state;
  return {
    storyId,
    remount: () => api.emit(FORCE_REMOUNT, { storyId: state.storyId }),
    api,
  };
};

export const remountTool: Addon_BaseType = {
  title: 'remount',
  id: 'remount',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={menuMapper}>
      {({ remount, storyId, api }) => {
        const [isAnimating, setIsAnimating] = useState(false);
        const remountComponent = () => {
          if (!storyId) return;
          remount();
        };

        api.on(FORCE_REMOUNT, () => {
          setIsAnimating(true);
        });

        return (
          <StyledAnimatedIconButton
            key="remount"
            title="Remount component"
            onClick={remountComponent}
            onAnimationEnd={() => setIsAnimating(false)}
            animating={isAnimating}
            disabled={!storyId}
          >
            <SyncIcon />
          </StyledAnimatedIconButton>
        );
      }}
    </Consumer>
  ),
};
