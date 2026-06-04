import React, { type FC, useState } from 'react';

import { Button, IconButton } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  ChevronSmallLeftIcon,
  ChevronSmallRightIcon,
  SideBySideIcon,
  StopAltHollowIcon,
  StorybookIcon,
  TransferIcon,
} from '@storybook/icons';

import { ReviewHeader } from '../components/ReviewHeader.tsx';
import { buildStorybookStoryHref } from '../review-navigation.ts';

const Page = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  minHeight: 0,
  overflow: 'hidden',
  background: theme.background.content,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
}));

const SubtitleStrong = styled.span({
  fontWeight: 700,
});

const SubtitleSeparator = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

const Counter = styled(Button)(({ theme }) => ({
  fontVariantNumeric: 'tabular-nums',
  fontFamily: theme.typography.fonts.mono,
  fontWeight: theme.typography.weight.regular,
}));

const PreviewFrameWrap = styled.div({
  flex: 1,
  minHeight: 0,
  width: '100%',
  display: 'flex',
});

const PreviewFrame = styled.iframe({
  flex: 1,
  width: '100%',
  height: '100%',
  border: 0,
  display: 'block',
});

// The baseline comparison bar. A two-up (side-by-side) and one-up (single)
// mode share a control cluster; the "switch" control only applies in one-up
// mode, where it flips which pane (baseline or latest) is shown.
const BaselineBar = styled.div({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
});

const BarHalf = styled.div({
  display: 'flex',
  flex: 1,
  minWidth: 0,
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

const BarLabel = styled.strong(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  fontSize: 14,
  lineHeight: '20px',
  whiteSpace: 'nowrap',
}));

const BarControls = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
});

const storyPreviewUrl = (id: string) => `iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;

type CompareMode = 'split' | 'single';
type ComparePane = 'baseline' | 'latest';

export interface DetailsScreenProps {
  /** Fallback title shown when story metadata is unavailable. */
  title: string;
  storyId: string;
  storyIndex: number;
  totalStories: number;
  backHref: string;
  previousHref: string;
  nextHref: string;
  componentTitle?: string;
  storyName?: string;
  /** Enables the baseline/latest comparison controls when a baseline exists. */
  hasBaseline?: boolean;
}

const componentName = (componentTitle: string): string =>
  componentTitle
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop() ?? componentTitle;

const CompareControls: FC<{
  mode: CompareMode;
  onModeChange: (mode: CompareMode) => void;
  onSwitch: () => void;
}> = ({ mode, onModeChange, onSwitch }) => (
  <BarControls>
    {mode === 'single' ? (
      <IconButton
        variant="ghost"
        size="small"
        padding="small"
        ariaLabel="Switch baseline and latest"
        onClick={onSwitch}
      >
        <TransferIcon />
      </IconButton>
    ) : null}
    <IconButton
      variant="ghost"
      size="small"
      padding="small"
      active={mode === 'single'}
      ariaLabel="Single view"
      onClick={() => onModeChange('single')}
    >
      <StopAltHollowIcon />
    </IconButton>
    <IconButton
      variant="ghost"
      size="small"
      padding="small"
      active={mode === 'split'}
      ariaLabel="Side-by-side view"
      onClick={() => onModeChange('split')}
    >
      <SideBySideIcon />
    </IconButton>
  </BarControls>
);

// The preview <iframe> is intentionally a stable element: when the story
// changes the parent only updates `src`, so the iframe navigates in place
// without the manager (or this component) remounting — no flash.
export const DetailsScreen: FC<DetailsScreenProps> = ({
  title,
  storyId,
  storyIndex,
  totalStories,
  backHref,
  previousHref,
  nextHref,
  componentTitle,
  storyName,
  hasBaseline = false,
}) => {
  const [mode, setMode] = useState<CompareMode>('split');
  const [activePane, setActivePane] = useState<ComparePane>('latest');

  const subtitle =
    componentTitle && storyName ? (
      <>
        <SubtitleStrong>{componentName(componentTitle)}</SubtitleStrong>
        <SubtitleSeparator>/</SubtitleSeparator>
        <span>{storyName}</span>
      </>
    ) : undefined;

  const baselineBar = hasBaseline ? (
    mode === 'split' ? (
      <BaselineBar>
        <BarHalf>
          <BarLabel>Baseline</BarLabel>
          <span />
        </BarHalf>
        <BarHalf>
          <BarLabel>Latest</BarLabel>
          <CompareControls mode={mode} onModeChange={setMode} onSwitch={() => {}} />
        </BarHalf>
      </BaselineBar>
    ) : (
      <BaselineBar>
        <BarHalf>
          <BarLabel>{activePane === 'baseline' ? 'Baseline' : 'Latest'}</BarLabel>
          <CompareControls
            mode={mode}
            onModeChange={setMode}
            onSwitch={() => setActivePane((pane) => (pane === 'baseline' ? 'latest' : 'baseline'))}
          />
        </BarHalf>
      </BaselineBar>
    )
  ) : undefined;

  return (
    <Page>
      <ReviewHeader
        autoFocusTitle
        leading={
          <IconButton
            variant="ghost"
            size="small"
            padding="small"
            ariaLabel="Back to review"
            asChild
          >
            <a href={backHref}>
              <ChevronSmallLeftIcon />
            </a>
          </IconButton>
        }
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Counter variant="ghost" size="small" readOnly>
              {storyIndex + 1}/{totalStories}
            </Counter>
            <IconButton
              variant="ghost"
              size="small"
              padding="small"
              ariaLabel="Previous story"
              asChild
            >
              <a href={previousHref}>
                <ChevronSmallLeftIcon />
              </a>
            </IconButton>
            <IconButton variant="ghost" size="small" padding="small" ariaLabel="Next story" asChild>
              <a href={nextHref}>
                <ChevronSmallRightIcon />
              </a>
            </IconButton>
            <IconButton size="small" padding="small" ariaLabel="View in Storybook" asChild>
              <a href={buildStorybookStoryHref(storyId)} target="_blank" rel="noreferrer">
                <StorybookIcon />
              </a>
            </IconButton>
          </>
        }
        secondRow={baselineBar}
      />

      <PreviewFrameWrap>
        <PreviewFrame title={storyId} src={storyPreviewUrl(storyId)} />
      </PreviewFrameWrap>
    </Page>
  );
};
