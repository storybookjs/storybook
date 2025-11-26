import type { FC, SyntheticEvent } from 'react';
import React from 'react';

import { Button, Toolbar as SharedToolbar, getStoryHref } from 'storybook/internal/components';

import { ShareAltIcon, ZoomIcon, ZoomOutIcon, ZoomResetIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

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

const AbsoluteBar = styled(SharedToolbar)({
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  transition: 'transform .2s linear',
  display: 'flex',
  alignItems: 'center',
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
  <AbsoluteBar innerStyle={{ gap: 4, paddingInline: 7, justifyContent: 'space-between' }} {...rest}>
    <Wrapper key="left">
      {isLoading ? (
        [1, 2, 3].map((key) => <IconPlaceholder key={key} />)
      ) : (
        <>
          <Button
            padding="small"
            variant="ghost"
            key="zoomin"
            onClick={(e: SyntheticEvent) => {
              e.preventDefault();
              zoom(0.8);
            }}
            ariaLabel="Zoom in"
          >
            <ZoomIcon />
          </Button>
          <Button
            padding="small"
            variant="ghost"
            key="zoomout"
            onClick={(e: SyntheticEvent) => {
              e.preventDefault();
              zoom(1.25);
            }}
            ariaLabel="Zoom out"
          >
            <ZoomOutIcon />
          </Button>
          <Button
            padding="small"
            variant="ghost"
            key="zoomreset"
            onClick={(e: SyntheticEvent) => {
              e.preventDefault();
              resetZoom();
            }}
            ariaLabel="Reset zoom"
          >
            <ZoomResetIcon />
          </Button>
        </>
      )}
    </Wrapper>

    {isLoading ? (
      <Wrapper key="right">
        <IconPlaceholder />
      </Wrapper>
    ) : (
      baseUrl &&
      storyId && (
        <Wrapper key="right">
          <Button
            asChild
            padding="small"
            variant="ghost"
            key="opener"
            ariaLabel="Open canvas in new tab"
          >
            <a href={getStoryHref(baseUrl, storyId)} target="_blank" rel="noopener noreferrer">
              <ShareAltIcon />
            </a>
          </Button>
        </Wrapper>
      )
    )}
  </AbsoluteBar>
);
