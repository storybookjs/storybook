import React, { type FC } from 'react';

import { Button } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { CheckIcon, ChevronSmallLeftIcon, ChevronSmallRightIcon } from '@storybook/icons';

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

const CollectionTitle = styled.h2({
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: '20px',
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

const storyPreviewUrl = (id: string) => `iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;

export interface DetailsScreenProps {
  collectionTitle: string;
  storyId: string;
  storyIndex: number;
  totalStories: number;
  backHref: string;
  previousHref: string;
  nextHref: string;
  branchName?: string;
  onMarkViewed?: () => void;
}

export const DetailsScreen: FC<DetailsScreenProps> = ({
  collectionTitle,
  storyId,
  storyIndex,
  totalStories,
  backHref,
  previousHref,
  nextHref,
  branchName,
  onMarkViewed,
}) => (
  <Page>
    <Toolbar>
      <ToolbarSide>
        <Button
          variant="ghost"
          size="small"
          padding="small"
          ariaLabel="Back to collections"
          asChild
        >
          <a href={backHref}>
            <ChevronSmallLeftIcon />
          </a>
        </Button>
        <CollectionTitle>{collectionTitle}</CollectionTitle>
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
        <Button
          variant="ghost"
          size="small"
          padding="small"
          ariaLabel="Mark as viewed"
          onClick={onMarkViewed}
        >
          <CheckIcon />
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
