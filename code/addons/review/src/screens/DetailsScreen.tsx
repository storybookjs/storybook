import React, { type FC } from 'react';

import { Button } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { ChevronSmallLeftIcon, ChevronSmallRightIcon } from '@storybook/icons';

const Page = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  minHeight: '100dvh',
  overflow: 'hidden',
  background: theme.background.content,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
}));

const Toolbar = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  minHeight: 40,
  padding: '0 10px',
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const ToolbarSide = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
});

const DetailTitle = styled.h2({
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: '20px',
});

const DetailTitleMuted = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  fontWeight: 400,
}));

const DetailTitleStrong = styled.span({
  fontWeight: 700,
});

const DetailTitleRegular = styled.span({
  fontWeight: 400,
});

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

const BottomToolbar = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  minHeight: 40,
  padding: '0 10px 0 16px',
  borderTop: `1px solid ${theme.appBorderColor}`,
}));

const BranchText = styled.div({
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 600,
});

const BottomRightPlaceholder = styled.div({
  width: 24,
  height: 24,
});

const storyPreviewUrl = (id: string) =>
  `iframe.html?id=${encodeURIComponent(id)}&viewMode=story&freeze=finished`;

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
  branchName?: string;
}

const renderDetailTitle = ({
  title,
  componentTitle,
  storyName,
}: Pick<DetailsScreenProps, 'title' | 'componentTitle' | 'storyName'>) => {
  if (!componentTitle || !storyName) {
    return title;
  }

  const componentName =
    componentTitle
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .pop() ?? componentTitle;

  return (
    <>
      <DetailTitleStrong>{componentName}</DetailTitleStrong>
      <DetailTitleMuted>{' / '}</DetailTitleMuted>
      <DetailTitleRegular>{storyName}</DetailTitleRegular>
    </>
  );
};

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
  branchName,
}) => (
  <Page>
    <Toolbar>
      <ToolbarSide>
        <Button variant="ghost" size="small" padding="small" ariaLabel="Back to review" asChild>
          <a href={backHref}>
            <ChevronSmallLeftIcon />
          </a>
        </Button>
        <DetailTitle>{renderDetailTitle({ title, componentTitle, storyName })}</DetailTitle>
      </ToolbarSide>

      <ToolbarSide>
        <Button variant="ghost" size="small" readOnly>
          {storyIndex + 1}/{totalStories}
        </Button>
        <Button variant="ghost" size="small" padding="small" ariaLabel="Previous story" asChild>
          <a href={previousHref}>
            <ChevronSmallLeftIcon />
          </a>
        </Button>
        <Button variant="ghost" size="small" padding="small" ariaLabel="Next story" asChild>
          <a href={nextHref}>
            <ChevronSmallRightIcon />
          </a>
        </Button>
      </ToolbarSide>
    </Toolbar>

    <PreviewFrameWrap>
      <PreviewFrame title={storyId} src={storyPreviewUrl(storyId)} />
    </PreviewFrameWrap>

    <BottomToolbar>
      <BranchText>Latest on {branchName ?? 'this branch'}</BranchText>
      <BottomRightPlaceholder />
    </BottomToolbar>
  </Page>
);
