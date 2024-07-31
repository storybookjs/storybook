import type { FC, MouseEvent } from 'react';
import React from 'react';
import { styled } from 'storybook/internal/theming';
import { FlexBar, IconButton } from 'storybook/internal/components';
import { ZoomIcon, ZoomOutIcon, ZoomResetIcon } from '@storybook/icons';

interface ZoomProps {
  zoom: (val: number) => void;
  resetZoom: () => void;
}

interface EjectProps {
  storyId?: string;
  baseUrl?: string;
}

interface BarProps {
  border?: boolean;
}

interface LoadingProps {
  isLoading?: boolean;
}

export type ToolbarProps = BarProps & ZoomProps & EjectProps & LoadingProps;

const Bar = styled(FlexBar)({
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  transition: 'transform .2s linear',
});

const Wrapper = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const IconPlaceholder = styled.div(({ theme }) => ({
  width: 14,
  height: 14,
  borderRadius: 2,
  margin: '0 7px',
  backgroundColor: theme.appBorderColor,
  animation: `${theme.animation.glow} 1.5s ease-in-out infinite`,
}));

export const Toolbar: FC<ToolbarProps> = ({
  isLoading,
  storyId,
  baseUrl,
  zoom,
  resetZoom,
  ...rest
}) => (
  <Bar {...rest}>
    <Wrapper key="left">
      {isLoading ? (
        [1, 2, 3].map((key) => <IconPlaceholder key={key} />)
      ) : (
        <>
          <IconButton
            key="zoomin"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              zoom(0.8);
            }}
            title="Zoom in"
          >
            <ZoomIcon />
          </IconButton>
          <IconButton
            key="zoomout"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              zoom(1.25);
            }}
            title="Zoom out"
          >
            <ZoomOutIcon />
          </IconButton>
          <IconButton
            key="zoomreset"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              resetZoom();
            }}
            title="Reset zoom"
          >
            <ZoomResetIcon />
          </IconButton>
        </>
      )}
    </Wrapper>
  </Bar>
);
