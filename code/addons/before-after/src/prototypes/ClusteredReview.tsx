/**
 * Prototype B — clustered review page with zoom-out / zoom-in.
 *
 * Represents iteration-2 (or iteration-1 with AI from day one): the
 * agent's cluster signatures shape the page. Default ("zoom-out") view
 * shows a grid of cluster cards with rationales and representative
 * previews. Click a cluster to "zoom in" — see all member stories with
 * full previews.
 */
import React, { useState } from 'react';

import { styled } from 'storybook/theming';

import {
  type MockCluster,
  type MockReviewData,
  type StoryStatus,
  statusColors,
  statusLabel,
} from './mockData.ts';

interface ClusteredReviewProps {
  data: MockReviewData;
}

const Page = styled.div(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  color: theme.color.defaultText,
  background: theme.background.app,
  minHeight: '100vh',
}));

const TopBar = styled.div(({ theme }) => ({
  padding: '16px 24px',
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap' as const,
}));

const Title = styled.h1(({ theme }) => ({
  fontSize: 18,
  margin: 0,
  color: theme.color.darker,
}));

const ChangedFile = styled.code(({ theme }) => ({
  fontSize: 12,
  color: theme.color.mediumdark,
  fontFamily: theme.typography.fonts.mono,
  background: theme.background.hoverable,
  padding: '3px 8px',
  borderRadius: 4,
}));

const Crumbs = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: theme.color.mediumdark,
}));

const CrumbLink = styled.button(({ theme }) => ({
  background: 'none',
  border: 'none',
  color: theme.color.secondary,
  cursor: 'pointer',
  padding: 0,
  fontSize: 13,
  '&:hover': { textDecoration: 'underline' },
}));

const ZoomOutButton = styled.button(({ theme }) => ({
  marginLeft: 'auto',
  border: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  color: theme.color.defaultText,
  borderRadius: 4,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover': { background: theme.background.hoverable },
}));

const Counts = styled.div(({ theme }) => ({
  display: 'flex',
  gap: 8,
  fontSize: 12,
  color: theme.color.mediumdark,
}));

const CountChip = styled.span<{ kind: StoryStatus }>(({ kind }) => ({
  background: statusColors[kind].bg,
  color: statusColors[kind].fg,
  padding: '3px 10px',
  borderRadius: 999,
  fontWeight: 600,
}));

const Content = styled.div({
  padding: 24,
  maxWidth: 1200,
  margin: '0 auto',
});

const Banner = styled.div({
  background: '#eef2ff',
  border: '1px solid #c7d2fe',
  color: '#3730a3',
  padding: '8px 14px',
  borderRadius: 4,
  fontSize: 12,
  marginBottom: 16,
});

const ClusterGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
  gap: 16,
});

const ClusterCard = styled.div(({ theme }) => ({
  background: theme.background.content,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 8,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column' as const,
  cursor: 'pointer',
  transition: 'transform 0.1s, box-shadow 0.1s, border-color 0.1s',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.10)',
    borderColor: theme.color.secondary,
  },
}));

const ClusterHeader = styled.div(({ theme }) => ({
  padding: '14px 16px 10px',
  borderBottom: `1px solid ${theme.color.border}`,
}));

const ClusterId = styled.div(({ theme }) => ({
  fontSize: 15,
  fontWeight: 600,
  color: theme.color.darker,
  marginBottom: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap' as const,
}));

const DepthBadge = styled.span<{ depth: number }>(({ depth }) => {
  const colors = ['#fee2e2', '#fef3c7', '#dbeafe', '#f1f5f9'];
  const fgs = ['#b91c1c', '#b45309', '#1d4ed8', '#64748b'];
  const idx = Math.min(depth - 1, colors.length - 1);
  return {
    background: colors[idx] ?? colors[colors.length - 1],
    color: fgs[idx] ?? fgs[fgs.length - 1],
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    textTransform: 'uppercase' as const,
  };
});

const StoryCountBadge = styled.span(({ theme }) => ({
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
  background: theme.background.hoverable,
  color: theme.color.mediumdark,
}));

const Rationale = styled.p(({ theme }) => ({
  fontSize: 12.5,
  color: theme.color.mediumdark,
  margin: 0,
  lineHeight: 1.45,
}));

const RepresentativeWrap = styled.div(({ theme }) => ({
  position: 'relative' as const,
  background: theme.background.hoverable,
}));

const RepresentativeFrame = styled.iframe({
  width: '100%',
  height: 200,
  border: 'none',
  display: 'block',
});

const RepresentativeBadge = styled.div(({ theme }) => ({
  position: 'absolute' as const,
  top: 8,
  left: 8,
  background: theme.color.darker,
  color: theme.background.content,
  fontSize: 10,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 4,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
}));

const ClusterFooter = styled.div(({ theme }) => ({
  padding: '10px 16px',
  borderTop: `1px solid ${theme.color.border}`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: theme.color.mediumdark,
}));

const SpaceFill = styled.span({ flex: 1 });

const ZoomInLink = styled.span(({ theme }) => ({
  color: theme.color.secondary,
  fontWeight: 600,
}));

// ───── Detail view ─────────────────────────────────────────

const DetailHeader = styled.section(({ theme }) => ({
  background: theme.background.content,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 8,
  padding: 20,
  marginBottom: 20,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 8,
}));

const DetailTitle = styled.h2(({ theme }) => ({
  margin: 0,
  fontSize: 20,
  color: theme.color.darker,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap' as const,
}));

const DetailRationale = styled.p(({ theme }) => ({
  margin: 0,
  fontSize: 14,
  color: theme.color.mediumdark,
  lineHeight: 1.5,
}));

const DetailMeta = styled.div(({ theme }) => ({
  fontSize: 12,
  color: theme.color.mediumdark,
  marginTop: 4,
  display: 'flex',
  gap: 12,
}));

const StoryGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 16,
});

const StoryCard = styled.div(({ theme }) => ({
  background: theme.background.content,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 6,
  overflow: 'hidden',
}));

const StoryHeader = styled.div(({ theme }) => ({
  padding: '10px 14px',
  borderBottom: `1px solid ${theme.color.border}`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}));

const StoryTitle = styled.div(({ theme }) => ({
  flex: 1,
  fontSize: 13,
  fontWeight: 600,
  color: theme.color.darker,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}));

const StoryName = styled.span(({ theme }) => ({
  color: theme.color.mediumdark,
  fontWeight: 400,
}));

const StatusBadge = styled.span<{ kind: StoryStatus }>(({ kind }) => ({
  background: statusColors[kind].bg,
  color: statusColors[kind].fg,
  padding: '2px 7px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
}));

const PreviewFrame = styled.iframe(({ theme }) => ({
  width: '100%',
  height: 180,
  border: 'none',
  background: theme.background.content,
}));

const Truncated = styled.div(({ theme }) => ({
  padding: 12,
  textAlign: 'center' as const,
  fontSize: 12,
  color: theme.color.mediumdark,
  fontStyle: 'italic' as const,
}));

// ───── Component ──────────────────────────────────────────

export function ClusteredReview({ data }: ClusteredReviewProps) {
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const activeCluster: MockCluster | null = activeClusterId
    ? (data.clusters.find((c) => c.id === activeClusterId) ?? null)
    : null;

  return (
    <Page>
      <TopBar>
        <Title>Review changes</Title>
        <ChangedFile>{data.changedFile}</ChangedFile>
        <Counts>
          <CountChip kind="new">{data.newCount} new</CountChip>
          <CountChip kind="modified">{data.modifiedCount} modified</CountChip>
          <CountChip kind="related">{data.relatedCount} related</CountChip>
        </Counts>
        {activeCluster ? (
          <>
            <Crumbs>
              <CrumbLink onClick={() => setActiveClusterId(null)}>← Back to clusters</CrumbLink>
              <span>/</span>
              <span>{activeCluster.id}</span>
            </Crumbs>
            <ZoomOutButton onClick={() => setActiveClusterId(null)}>Zoom out</ZoomOutButton>
          </>
        ) : (
          <Crumbs style={{ marginLeft: 'auto' }}>
            {data.clusters.length} clusters · {data.cascadeSize} stories
          </Crumbs>
        )}
      </TopBar>

      <Content>
        {!activeCluster ? (
          <>
            <Banner>
              <strong>Prototype</strong> — clustered review with AI categorisation (zoom-out view).
              Each card shows the agent's rationale and a preview of the cluster's most
              representative story. Click a card to zoom in. Real cluster shapes drawn from the
              medium-scenario eval (1,025-story cascade clustered into 6 UX-usable groupings).
            </Banner>
            <ClusterGrid>
              {data.clusters.map((c) => (
                <ClusterCard key={c.id} onClick={() => setActiveClusterId(c.id)}>
                  <ClusterHeader>
                    <ClusterId>
                      {c.id}
                      {c.depthHint !== undefined && (
                        <DepthBadge depth={c.depthHint}>depth {c.depthHint}</DepthBadge>
                      )}
                      <StoryCountBadge>{c.totalStoryCount} stories</StoryCountBadge>
                    </ClusterId>
                    <Rationale>{c.rationale}</Rationale>
                  </ClusterHeader>
                  <RepresentativeWrap>
                    <RepresentativeBadge>★ Representative</RepresentativeBadge>
                    <RepresentativeFrame
                      title={c.representative}
                      src={`./iframe.html?id=${encodeURIComponent(c.representative)}&viewMode=story`}
                      loading="lazy"
                    />
                  </RepresentativeWrap>
                  <ClusterFooter>
                    <span>{c.representative}</span>
                    <SpaceFill />
                    <ZoomInLink>Zoom in →</ZoomInLink>
                  </ClusterFooter>
                </ClusterCard>
              ))}
            </ClusterGrid>
          </>
        ) : (
          <>
            <Banner>
              <strong>Zoomed in.</strong> Showing the {activeCluster.sampleStories.length}{' '}
              representative stories from this cluster (real eval would show all{' '}
              {activeCluster.totalStoryCount}). The agent's rationale is the section header below.
            </Banner>
            <DetailHeader>
              <DetailTitle>
                {activeCluster.id}
                {activeCluster.depthHint !== undefined && (
                  <DepthBadge depth={activeCluster.depthHint}>
                    depth {activeCluster.depthHint}
                  </DepthBadge>
                )}
                <StoryCountBadge>{activeCluster.totalStoryCount} stories</StoryCountBadge>
              </DetailTitle>
              <DetailRationale>{activeCluster.rationale}</DetailRationale>
              <DetailMeta>
                <span>★ Representative: {activeCluster.representative}</span>
              </DetailMeta>
            </DetailHeader>
            <StoryGrid>
              {activeCluster.sampleStories.map((s) => (
                <StoryCard key={s.storyId}>
                  <StoryHeader>
                    <StoryTitle>
                      {s.storyId === activeCluster.representative && '★ '}
                      {s.title} <StoryName>/ {s.name}</StoryName>
                    </StoryTitle>
                    <StatusBadge kind={s.status}>{statusLabel[s.status]}</StatusBadge>
                  </StoryHeader>
                  <PreviewFrame
                    title={s.storyId}
                    src={`./iframe.html?id=${encodeURIComponent(s.storyId)}&viewMode=story`}
                    loading="lazy"
                  />
                </StoryCard>
              ))}
            </StoryGrid>
            {activeCluster.totalStoryCount > activeCluster.sampleStories.length && (
              <Truncated>
                + {activeCluster.totalStoryCount - activeCluster.sampleStories.length} more stories
                in this cluster (truncated in this prototype)
              </Truncated>
            )}
          </>
        )}
      </Content>
    </Page>
  );
}
