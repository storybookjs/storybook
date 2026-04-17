import React from 'react';

import { styled } from 'storybook/theming';

import { AutoSizingIframe } from './AutoSizingIframe.tsx';

type StoryStatus = 'new' | 'modified' | 'affected';

interface StoryCardProps {
  storyId: string;
  status: StoryStatus;
  title: string;
  name: string;
  importPath: string;
  compareMode: boolean;
  beforeServerPort: number | null;
}

const Card = styled.div(({ theme }) => ({
  borderRadius: '6px',
  border: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  overflow: 'hidden',
}));

const CardHeader = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 14px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.app,
}));

const StoryTitle = styled.span(({ theme }) => ({
  fontSize: '13px',
  fontWeight: 600,
  color: theme.color.defaultText,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}));

const StoryPath = styled.span(({ theme }) => ({
  fontSize: '11px',
  color: theme.color.mediumdark,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
  maxWidth: '200px',
}));

const Badge = styled.span<{ variant: StoryStatus }>(({ theme, variant }) => {
  const colors: Record<StoryStatus, { bg: string; text: string }> = {
    new: { bg: theme.color.green, text: '#fff' },
    modified: { bg: theme.color.gold, text: '#fff' },
    affected: { bg: theme.color.secondary, text: '#fff' },
  };
  const { bg, text } = colors[variant];
  return {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.3px',
    textTransform: 'uppercase' as const,
    background: bg,
    color: text,
    flexShrink: 0,
  };
});

const IframeRow = styled.div({
  display: 'flex',
  width: '100%',
});

const IframeCol = styled.div({
  flex: '0 0 50%',
  width: '50%',
  overflow: 'hidden',
});

const IframeColLabel = styled.div(({ theme }) => ({
  fontSize: '11px',
  fontWeight: 600,
  color: theme.color.mediumdark,
  padding: '6px 10px 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  borderBottom: `1px solid ${theme.color.border}`,
}));

const Placeholder = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px',
  background: theme.background.hoverable,
  color: theme.color.mediumdark,
  fontSize: '12px',
}));

const LoadingPlaceholder = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px',
  background: `linear-gradient(90deg, ${theme.background.hoverable} 25%, ${theme.background.app} 50%, ${theme.background.hoverable} 75%)`,
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  color: theme.color.mediumdark,
  fontSize: '12px',
  '@keyframes shimmer': {
    '0%': { backgroundPosition: '200% 0' },
    '100%': { backgroundPosition: '-200% 0' },
  },
}));

const Divider = styled.div(({ theme }) => ({
  width: '1px',
  background: theme.color.border,
  flexShrink: 0,
}));

const BADGE_LABELS: Record<StoryStatus, string> = {
  new: 'New',
  modified: 'Modified',
  affected: 'Affected',
};

function buildIframeSrc(storyId: string, port: number): string {
  return `http://localhost:${port}/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
}

export const StoryCard = ({
  storyId,
  status,
  title,
  name,
  importPath,
  compareMode,
  beforeServerPort,
}: StoryCardProps) => {
  const afterSrc = `/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
  const beforeSrc = beforeServerPort !== null ? buildIframeSrc(storyId, beforeServerPort) : null;

  return (
    <Card id={`changes-story-${storyId}`}>
      <CardHeader>
        <StoryTitle>
          {title} / {name}
        </StoryTitle>
        <StoryPath>{importPath}</StoryPath>
        <Badge variant={status}>{BADGE_LABELS[status]}</Badge>
      </CardHeader>

      {compareMode ? (
        <IframeRow>
          <IframeCol>
            <IframeColLabel>Before</IframeColLabel>
            {status === 'new' ? (
              <Placeholder>No previous version</Placeholder>
            ) : beforeSrc === null ? (
              <LoadingPlaceholder>Starting before server...</LoadingPlaceholder>
            ) : (
              <AutoSizingIframe
                src={beforeSrc}
                storyId={`${storyId}__before`}
                title={`${title} / ${name} (before)`}
              />
            )}
          </IframeCol>
          <Divider />
          <IframeCol>
            <IframeColLabel>After</IframeColLabel>
            <AutoSizingIframe
              src={afterSrc}
              storyId={storyId}
              title={`${title} / ${name} (after)`}
            />
          </IframeCol>
        </IframeRow>
      ) : (
        <AutoSizingIframe src={afterSrc} storyId={storyId} title={`${title} / ${name}`} />
      )}
    </Card>
  );
};
