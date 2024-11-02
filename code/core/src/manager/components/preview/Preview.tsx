import type { FC } from 'react';
import React, { Fragment, useEffect, useRef, useState } from 'react';

import { Loader } from '@storybook/core/components';
import type { Addon_BaseType, Addon_WrapperType } from '@storybook/core/types';
import { global } from '@storybook/global';

import { PREVIEW_BUILDER_PROGRESS, SET_CURRENT_STORY } from '@storybook/core/core-events';
import { type Combo, Consumer, addons, merge, types } from '@storybook/core/manager-api';

import { Helmet } from 'react-helmet-async';

import { FramesRenderer } from './FramesRenderer';
import { ToolbarComp } from './Toolbar';
import { ApplyWrappers } from './Wrappers';
import { ZoomConsumer, ZoomProvider } from './tools/zoom';
import * as S from './utils/components';
import type { PreviewProps } from './utils/types';

const canvasMapper = ({ state, api }: Combo) => ({
  storyId: state.storyId,
  refId: state.refId,
  viewMode: state.viewMode,
  customCanvas: api.renderPreview,
  queryParams: state.customQueryParams,
  getElements: api.getElements,
  entry: api.getData(state.storyId, state.refId),
  previewInitialized: state.previewInitialized,
  refs: state.refs,
});

export const createCanvasTab = (): Addon_BaseType => ({
  id: 'canvas',
  type: types.TAB,
  title: 'Canvas',
  route: ({ storyId, refId }) => (refId ? `/story/${refId}_${storyId}` : `/story/${storyId}`),
  match: ({ viewMode }) => !!(viewMode && viewMode.match(/^(story|docs)$/)),
  render: () => null,
});

const Preview = React.memo<PreviewProps>(function Preview(props) {
  const {
    api,
    id: previewId,
    options,
    viewMode,
    storyId,
    entry = undefined,
    description,
    baseUrl,
    withLoader = true,
    tools,
    toolsExtra,
    tabs,
    wrappers,
    tabId,
  } = props;

  const tabContent = tabs.find((tab) => tab.id === tabId)?.render;

  const shouldScale = viewMode === 'story';
  const { showToolbar } = options;
  const shouldShowToolbar = api.getShowToolbarWithCustomisations(showToolbar);

  const previousStoryId = useRef(storyId);

  useEffect(() => {
    if (entry && viewMode) {
      // Don't emit the event on first ("real") render, only when entry changes
      if (storyId === previousStoryId.current) {
        return;
      }

      previousStoryId.current = storyId;

      if (viewMode.match(/docs|story/)) {
        const { refId, id } = entry;
        api.emit(SET_CURRENT_STORY, {
          storyId: id,
          viewMode,
          options: { target: refId },
        });
      }
    }
  }, [entry, viewMode, storyId, api]);

  return (
    <Fragment>
      {previewId === 'main' && (
        <Helmet key="description">
          <title>{description}</title>
        </Helmet>
      )}
      <ZoomProvider shouldScale={shouldScale}>
        <S.PreviewContainer>
          <ToolbarComp
            key="tools"
            isShown={shouldShowToolbar}
            // @ts-expect-error (non strict)
            tabId={tabId}
            tabs={tabs}
            tools={tools}
            toolsExtra={toolsExtra}
            api={api}
          />
          <S.FrameWrap key="frame">
            {tabContent && <S.IframeWrapper>{tabContent({ active: true })}</S.IframeWrapper>}
            <S.CanvasWrap show={!tabId}>
              <Canvas {...{ withLoader, baseUrl }} wrappers={wrappers} />
            </S.CanvasWrap>
          </S.FrameWrap>
        </S.PreviewContainer>
      </ZoomProvider>
    </Fragment>
  );
});

export { Preview };

const Canvas: FC<{
  withLoader: boolean;
  baseUrl: string;
  children?: never;
  wrappers: Addon_WrapperType[];
}> = ({ baseUrl, withLoader, wrappers }) => {
  return (
    <Consumer filter={canvasMapper}>
      {({
        entry,
        refs,
        customCanvas,
        storyId,
        refId,
        viewMode,
        queryParams,
        previewInitialized,
      }) => {
        const id = 'canvas';

        const [progress, setProgress] = useState(undefined);
        useEffect(() => {
          if (global.CONFIG_TYPE === 'DEVELOPMENT') {
            try {
              const channel = addons.getChannel();

              channel.on(PREVIEW_BUILDER_PROGRESS, (options) => {
                setProgress(options);
              });
            } catch {
              //
            }
          }
        }, []);
        // A ref simply depends on its readiness
        // @ts-expect-error (non strict)
        const refLoading = !!refs[refId] && !refs[refId].previewInitialized;
        // The root also might need to wait on webpack
        // @ts-expect-error (non strict)
        const isBuilding = !(progress?.value === 1 || progress === undefined);
        const rootLoading = !refId && (!previewInitialized || isBuilding);
        const isLoading = entry ? refLoading || rootLoading : rootLoading;

        return (
          <ZoomConsumer>
            {({ value: scale }) => {
              return (
                <>
                  {withLoader && isLoading && (
                    <S.LoaderWrapper>
                      <Loader id="preview-loader" role="progressbar" progress={progress} />
                    </S.LoaderWrapper>
                  )}
                  <ApplyWrappers id={id} storyId={storyId} viewMode={viewMode} wrappers={wrappers}>
                    {customCanvas ? (
                      customCanvas(storyId, viewMode, id, baseUrl, scale, queryParams)
                    ) : (
                      <FramesRenderer
                        baseUrl={baseUrl}
                        refs={refs}
                        scale={scale}
                        entry={entry}
                        viewMode={viewMode}
                        // @ts-expect-error (non strict)
                        refId={refId}
                        queryParams={queryParams}
                        storyId={storyId}
                      />
                    )}
                  </ApplyWrappers>
                </>
              );
            }}
          </ZoomConsumer>
        );
      }}
    </Consumer>
  );
};

export function filterTabs(panels: Addon_BaseType[], parameters?: Record<string, any> | undefined) {
  const { previewTabs } = addons.getConfig();
  const parametersTabs = parameters ? parameters.previewTabs : undefined;

  if (previewTabs || parametersTabs) {
    // deep merge global and local settings
    const tabs = merge(previewTabs || {}, parametersTabs || {});
    const arrTabs = Object.keys(tabs).map((key, index) => ({
      index,
      ...(typeof tabs[key] === 'string' ? { title: tabs[key] } : tabs[key]),
      id: key,
    }));
    return panels
      .filter((panel) => {
        const t = arrTabs.find((tab) => tab.id === panel.id);
        return t === undefined || t.id === 'canvas' || !t.hidden;
      })
      .map((panel, index) => ({ ...panel, index }) as Addon_BaseType)
      .sort((p1, p2) => {
        /* eslint-disable @typescript-eslint/naming-convention */
        const tab_1 = arrTabs.find((tab) => tab.id === p1.id);
        // @ts-expect-error (Converted from ts-ignore)
        const index_1 = tab_1 ? tab_1.index : arrTabs.length + p1.index;
        const tab_2 = arrTabs.find((tab) => tab.id === p2.id);
        // @ts-expect-error (Converted from ts-ignore)
        const index_2 = tab_2 ? tab_2.index : arrTabs.length + p2.index;
        return index_1 - index_2;
        /* eslint-enable @typescript-eslint/naming-convention */
      })
      .map((panel) => {
        const t = arrTabs.find((tab) => tab.id === panel.id);
        if (t) {
          return {
            ...panel,
            title: t.title || panel.title,
            disabled: t.disabled,
            hidden: t.hidden,
          } as Addon_BaseType;
        }
        return panel;
      });
  }
  return panels;
}
