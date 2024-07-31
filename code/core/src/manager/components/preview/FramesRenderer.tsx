import type { FC } from 'react';
import React, { useRef, Fragment } from 'react';
import type { Combo } from '@storybook/core/manager-api';
import { Consumer } from '@storybook/core/manager-api';
import { Button, getStoryHref } from '@storybook/core/components';
import { Global, styled } from '@storybook/core/theming';
import type { CSSObject } from '@storybook/core/theming';
import { IFrame } from './Iframe';
import type { FramesRendererProps } from './utils/types';
import { stringifyQueryParams } from './utils/stringifyQueryParams';

const getActive = (refId: FramesRendererProps['refId'], refs: FramesRendererProps['refs']) => {
  if (refId && refs[refId]) {
    return `storybook-ref-${refId}`;
  }

  return 'storybook-preview-iframe';
};

const SkipToSidebarLink = styled(Button)(({ theme }) => ({
  display: 'none',
  '@media (min-width: 600px)': {
    position: 'absolute',
    display: 'block',
    top: 10,
    right: 15,
    padding: '10px 15px',
    fontSize: theme.typography.size.s1,
    transform: 'translateY(-100px)',
    '&:focus': {
      transform: 'translateY(0)',
      zIndex: 1,
    },
  },
}));

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
  refs,
  scale,
  viewMode = 'story',
  refId,
  queryParams = {},
  baseUrl,
  storyId = '*',
}) => {
  const version = refs[refId]?.version;
  const stringifiedQueryParams = stringifyQueryParams({
    ...queryParams,
    ...(version && { version }),
  });
  const active = getActive(refId, refs);
  const { current: frames } = useRef<Record<string, string>>({});

  const refsToLoad = Object.values(refs).filter((ref) => {
    return ref.type === 'auto-inject' || ref.id === refId;
  }, {});

  if (!frames['storybook-preview-iframe']) {
    frames['storybook-preview-iframe'] = getStoryHref(baseUrl, storyId, {
      ...queryParams,
      ...(version && { version }),
      viewMode,
    });
  }

  refsToLoad.forEach((ref) => {
    const id = `storybook-ref-${ref.id}`;
    const existingUrl = frames[id]?.split('/iframe.html')[0];
    if (!existingUrl || ref.url !== existingUrl) {
      const newUrl = `${ref.url}/iframe.html?id=${storyId}&viewMode=${viewMode}&refId=${ref.id}${stringifiedQueryParams}`;
      frames[id] = newUrl;
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
            <SkipToSidebarLink asChild>
              <a href={`#${selectedStoryId}`} tabIndex={0} title="Skip to sidebar">
                Skip to sidebar
              </a>
            </SkipToSidebarLink>
          );
        }}
      </Consumer>
      {Object.entries(frames).map(([id, src]) => {
        return (
          <Fragment key={id}>
            <IFrame
              active={id === active}
              key={id}
              id={id}
              title={id}
              src={src}
              allowFullScreen
              scale={scale}
            />
          </Fragment>
        );
      })}
    </Fragment>
  );
};
