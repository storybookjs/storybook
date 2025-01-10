import type { IframeHTMLAttributes } from 'react';
import React from 'react';

import { Zoom } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';

const StyledIframe = styled.iframe(({ theme }) => ({
  backgroundColor: theme.background.preview,
  display: 'block',
  boxSizing: 'content-box',
  height: '100%',
  width: '100%',
  border: '0 none',
  transition: 'background-position 0s, visibility 0s',
  backgroundPosition: '-1px -1px, -1px -1px, -1px -1px, -1px -1px',
  margin: `auto`,
  boxShadow: '0 0 100px 100vw rgba(0,0,0,0.5)',
}));

export interface IFrameProps {
  id: string;
  title: string;
  src: string;
  allowFullScreen: boolean;
  scale: number;
  active: boolean;
}

export function IFrame(props: IFrameProps & IframeHTMLAttributes<HTMLIFrameElement>) {
  const { active, id, title, src, allowFullScreen, scale, ...rest } = props;
  const iFrameRef = React.useRef<HTMLIFrameElement>(null);
  return (
    <Zoom.IFrame scale={scale} active={active} iFrameRef={iFrameRef}>
      <StyledIframe
        data-is-storybook={active ? 'true' : 'false'}
        onLoad={(e) => e.currentTarget.setAttribute('data-is-loaded', 'true')}
        id={id}
        title={title}
        src={src}
        allow="clipboard-write;"
        allowFullScreen={allowFullScreen}
        ref={iFrameRef}
        {...rest}
      />
    </Zoom.IFrame>
  );
}
