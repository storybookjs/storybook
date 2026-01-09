import type { FC } from 'react';
import React, { Fragment, useEffect, useRef, useState } from 'react';

import { deprecate } from 'storybook/internal/client-logger';
import { Loader, useTabsState } from 'storybook/internal/components';
import { PREVIEW_BUILDER_PROGRESS, SET_CURRENT_STORY } from 'storybook/internal/core-events';
import type { Addon_BaseType, Addon_WrapperType } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { TabListState } from '@react-stately/tabs';
import { Helmet } from 'react-helmet-async';
import { type Combo, Consumer, addons, merge, types } from 'storybook/manager-api';

import { FramesRenderer } from './FramesRenderer';
import { ToolbarComp } from './Toolbar';
import { ApplyWrappers } from './Wrappers';
import { ZoomConsumer, ZoomProvider } from './tools/zoom';
import * as S from './utils/components';
import type { PreviewProps } from './utils/types';

const canvasMapper = ({ state, api }: Combo) => ({
  api,
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

  // SB11: remove code
  // NOTE: we interface with the old API without rewriting the UI because we know
  // that addon tabs are pretty rare and we want to deprecate them. To make this UI
  // accessible, we'd need to pass tabContent/CanvasWrap to the tabs consumed by
  // the TabPanel. It's doable, but not worth the effort considering the feature's
  // remaining lifespan.
  const tabState = useTabsState({
    selected: tabId ?? 'canvas',
    onSelectionChange: (key) => {
      api.applyQueryParams({ tab: key === 'canvas' ? undefined : key });
    },
    tabs: tabs.map((tab, index) => ({
      id: tab.id ?? `tab-${index}`,
      title: tab.title,
      isDisabled: !!tab.disabled,
      children: () => tab.render({ active: true }),
    })),
  });

  if (tabs.length > 1) {
    deprecate('Addon tabs are deprecated and will be removed in Storybook 11.');
  }
  // SB11: end remove code

  const tabContent = tabs.find((tab) => tab.id === tabId)?.render;

  const shouldScale = viewMode === 'story';
  const { showToolbar } = options;
  const customisedShowToolbar = api.getShowToolbarWithCustomisations(showToolbar);

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
            isShown={customisedShowToolbar}
            tabs={tabs}
            tabState={tabState as TabListState<object>}
            tools={tools}
            toolsExtra={toolsExtra}
          />
          <S.FrameWrap aria-labelledby="main-preview-heading">
            <h2 id="main-preview-heading" className="sb-sr-only">
              Main preview area
            </h2>
            {tabContent && <S.IframeWrapper>{tabContent({ active: true })}</S.IframeWrapper>}
            <S.CanvasWrap show={!tabId || tabId === 'canvas'}>
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
        api,
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
                        api={api}
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
        const tab_1 = arrTabs.find((tab) => tab.id === p1.id);
        // @ts-expect-error (Converted from ts-ignore)
        const index_1 = tab_1 ? tab_1.index : arrTabs.length + p1.index;
        const tab_2 = arrTabs.find((tab) => tab.id === p2.id);
        // @ts-expect-error (Converted from ts-ignore)
        const index_2 = tab_2 ? tab_2.index : arrTabs.length + p2.index;
        return index_1 - index_2;
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
