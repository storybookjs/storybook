import type { FC } from 'react';
import React, { Fragment, useRef } from 'react';

import { Button } from 'storybook/internal/components';

import type { Combo } from 'storybook/manager-api';
import { Consumer } from 'storybook/manager-api';
import { Global, styled } from 'storybook/theming';
import type { CSSObject } from 'storybook/theming';

import { Viewport } from './Viewport';
import type { FramesRendererProps } from './utils/types';

const getActive = (refId: FramesRendererProps['refId'], refs: FramesRendererProps['refs']) => {
  if (refId && refs[refId]) {
    return `storybook-ref-${refId}`;
  }

  return 'storybook-preview-iframe';
};

const SkipToSidebarLink = styled(Button)({
  display: 'none',
  '@media (min-width: 600px)': {
    position: 'absolute',
    display: 'block',
    top: 10,
    right: 15,
    padding: '10px 15px',
    fontSize: `var(--sb-typography-size-s1)`,
    transform: 'translateY(-100px)',
    '&:focus': {
      transform: 'translateY(0)',
      zIndex: 1,
    },
  },
});

const whenSidebarIsVisible = ({ api, state }: Combo) => ({
  isFullscreen: api.getIsFullscreen(),
  isNavShown: api.getIsNavShown(),
  selectedStoryId: state.storyId,
});

const styles: CSSObject = {
  '#root [data-is-storybook="false"]': {
    display: 'none',
  },
  '#root [data-is-storybook="true"]': {
    display: 'block',
  },
};

export const FramesRenderer: FC<FramesRendererProps> = ({
  api,
  refs,
  scale,
  viewMode = 'story',
  refId,
  queryParams = {},
  storyId = '*',
}) => {
  const version = refs[refId]?.version;
  const active = getActive(refId, refs);
  const { current: frames } = useRef<Record<string, string>>({});

  const refsToLoad = Object.values(refs).filter((ref) => {
    return ref.type === 'auto-inject' || ref.id === refId;
  }, {});

  if (!frames['storybook-preview-iframe']) {
    frames['storybook-preview-iframe'] = api.getStoryHrefs(storyId, {
      queryParams: { ...queryParams, ...(version && { version }) },
      refId,
      viewMode,
    }).previewHref;
  }

  refsToLoad.forEach((ref) => {
    const id = `storybook-ref-${ref.id}`;
    if (!frames[id]?.startsWith(ref.url)) {
      frames[id] = api.getStoryHrefs(storyId, {
        queryParams: { ...queryParams, ...(version && { version }) },
        refId: ref.id,
        viewMode,
      }).previewHref;
    }
  });

  return (
    <Fragment>
      <Global styles={styles} />
      <Consumer filter={whenSidebarIsVisible}>
        {({ isFullscreen, isNavShown, selectedStoryId }) => {
          if (isFullscreen || !isNavShown || !selectedStoryId) {
            return null;
          }
          return (
            <SkipToSidebarLink ariaLabel={false} asChild>
              <a href={`#${selectedStoryId}`} tabIndex={0} title="Skip to sidebar">
                Skip to sidebar
              </a>
            </SkipToSidebarLink>
          );
        }}
      </Consumer>
      {Object.entries(frames).map(([id, src]) => (
        <Viewport key={id} id={id} src={src} active={id === active} scale={scale} />
      ))}
    </Fragment>
  );
};
