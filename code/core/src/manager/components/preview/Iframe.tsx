import type { IframeHTMLAttributes } from 'react';
import React, { useCallback, useEffect, useRef } from 'react';

import { Zoom } from 'storybook/internal/components';

import { styled, useTheme } from 'storybook/theming';

const StyledIframe = styled.iframe(({ theme }) => ({
  // The surrounding chrome colour rather than `background.preview`, so the overscroll gutter — which
  // sits inside the iframe box but outside the preview document's scroll extent, and is therefore
  // painted from this element — blends into Storybook instead of flashing white over a dark story.
  backgroundColor: theme.background.app,
  display: 'block',
  boxSizing: 'content-box',
  height: '100%',
  width: '100%',
  border: 'none',
  transition: 'background-position 0s, visibility 0s',
  backgroundPosition: '-1px -1px, -1px -1px, -1px -1px, -1px -1px',
  margin: `auto`,
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
  const iFrameRef = useRef<HTMLIFrameElement>(null);
  const previewBackground = useTheme().background.preview;

  // The story canvas is painted by the preview document, so `appPreviewBg` has to reach it. A
  // cross-origin composed ref yields a null `contentDocument` rather than throwing, so the optional
  // chain is the whole guard and that ref keeps whatever its own Storybook set.
  const syncPreviewBackground = useCallback(() => {
    iFrameRef.current?.contentDocument?.documentElement.style.setProperty(
      '--sb-preview-background',
      previewBackground
    );
  }, [previewBackground]);

  // Assigning `src` replaces the document, so this only covers later theme changes; `onLoad` is what
  // lands the value on a freshly loaded preview.
  useEffect(() => {
    syncPreviewBackground();
  }, [syncPreviewBackground]);

  return (
    <Zoom.IFrame scale={scale} active={active} iFrameRef={iFrameRef}>
      <StyledIframe
        data-is-storybook={active ? 'true' : 'false'}
        onLoad={(e) => {
          e.currentTarget.setAttribute('data-is-loaded', 'true');
          syncPreviewBackground();
        }}
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
