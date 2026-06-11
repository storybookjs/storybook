import React, { useRef, type FC, type PropsWithChildren } from 'react';

import type { Addon_WrapperType } from 'storybook/internal/types';

import { types, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { useReview } from './review-store.ts';
import { useBaselineComparison } from './screens/useBaselineComparison.ts';

const CompareRoot = styled.div({
  display: 'flex',
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  width: '100%',
  height: '100%',
  position: 'relative',
});

const Pane = styled.div<{ $singleUp: boolean; $active: boolean }>(({ $singleUp, $active }) => ({
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  ...($singleUp
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: $active ? 1 : 0,
        pointerEvents: $active ? 'auto' : 'none',
        visibility: $active ? 'visible' : 'hidden',
      }
    : {
        flex: 1,
        position: 'relative',
      }),
}));

const PaneDivider = styled.div(({ theme }) => ({
  width: 1,
  flexShrink: 0,
  background: theme.color.border,
}));

const BaselineFrame = styled.iframe({
  flex: 1,
  width: '100%',
  height: '100%',
  border: 0,
  display: 'block',
});

const LatestPane = styled.div<{ $singleUp: boolean; $active: boolean }>(
  ({ $singleUp, $active }) => ({
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flex: $singleUp ? undefined : 1,
    ...($singleUp
      ? {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: $active ? 1 : 0,
          pointerEvents: $active ? 'auto' : 'none',
          visibility: $active ? 'visible' : 'hidden',
        }
      : {
          position: 'relative',
        }),
  })
);

const ReviewPreviewCompare: FC<PropsWithChildren> = ({ children }) => {
  const api = useStorybookApi();
  const { compareMode, showCompare, activeEntry } = useReview();
  const latestPaneRef = useRef<HTMLDivElement>(null);
  const storyId = activeEntry?.storyId ?? '';
  const previewHref = storyId ? api.getStoryHrefs(storyId).previewHref : '';

  const { baselineFrameRef, latestPreviewSrc, baselinePreviewSrc } = useBaselineComparison(
    previewHref,
    showCompare
  );

  if (!showCompare || !activeEntry) {
    return <>{children}</>;
  }

  const isSingleUp = compareMode !== 'split';
  const showLatest = compareMode === 'latest' || compareMode === 'split';
  const showBaseline = compareMode === 'baseline' || compareMode === 'split';

  return (
    <CompareRoot data-testid="review-preview-compare">
      {compareMode === 'split' ? (
        <>
          <Pane $singleUp={false} $active>
            <BaselineFrame
              ref={baselineFrameRef}
              title={`Baseline ${storyId}`}
              src={baselinePreviewSrc}
            />
          </Pane>
          <PaneDivider />
        </>
      ) : (
        <Pane $singleUp $active={showBaseline}>
          <BaselineFrame
            ref={baselineFrameRef}
            title={`Baseline ${storyId}`}
            src={baselinePreviewSrc}
          />
        </Pane>
      )}
      <LatestPane ref={latestPaneRef} $singleUp={isSingleUp} $active={showLatest}>
        {children}
      </LatestPane>
      {/* Keep latest preview URL in sync for the hook when not using the iframe ref directly */}
      <span hidden>{latestPreviewSrc}</span>
    </CompareRoot>
  );
};

export const reviewPreviewWrapper: Addon_WrapperType = {
  id: 'storybook/addon-review/preview',
  type: types.PREVIEW,
  render: ({ children }) => <ReviewPreviewCompare>{children}</ReviewPreviewCompare>,
};
