/**
 * Prototype G — MeticulousReview v2 (real Meticulous UI).
 *
 * The previous "Meticulous-style" prototype was extrapolating from
 * documentation; the two reference screenshots the user shared show
 * the actual UI is a darker, denser layout. This prototype matches it:
 *
 *   • Pure-black background, dense dark theme.
 *   • Left pane: collapsible **route tree**. Each route (cluster here)
 *     expands inline into a small thumbnail GRID of its variants
 *     (stories), each thumbnail showing a count badge in the corner
 *     and a "View all N" tile when truncated. Route headers carry
 *     variant chips (A, B, C…) instead of approval status.
 *   • Right pane: ONE big screenshot preview of the selected variant
 *     at near-full panel width, with an emulator-style email-verify
 *     banner up top to mimic the reference. Below it: a strip labelled
 *     "And sub-variants N tested" showing the cluster's neighbouring
 *     stories in horizontal cards.
 *   • Top secondary view (toggled via tabs at the very top): a
 *     "Changes" mode that mirrors the second reference — a "Grouping:
 *     [HTML Diff / URLs / User Flow]" segmented radio, "Change #1"
 *     and "Change #2" sections with red-highlighted thumbnails, and a
 *     big preview on the right with an orange ring drawn around the
 *     changed region.
 *
 * Mapping to our Storybook data:
 *   - Route = cluster (the rationale-grouped section)
 *   - Variant = story (sampleStories of a cluster)
 *   - Sub-variants strip = siblings of the active story within the
 *     same cluster
 *   - "Changes" mode = treats each cluster as one "Change #N"
 */
import React, { useMemo, useState } from 'react';

import { styled } from 'storybook/theming';

import { LazyStoryFrame, LazyThumbFrame } from './LazyStoryFrame.tsx';
import { type MockCluster, type MockReviewData, type MockStory, statusLabel } from './mockData.ts';

interface MeticulousV2ReviewProps {
  data: MockReviewData;
  initialStoryId?: string;
  initialMode?: 'tests' | 'changes';
}

// ── Palette (from screenshots) ────────────────────────────────────
const BG = '#000000';
const PANEL = '#0c0c0c';
const PANEL_2 = '#161616';
const BORDER = '#262626';
const BORDER_2 = '#1c1c1c';
const TEXT = '#e8e8e8';
const DIM = '#9a9a9a';
const VERY_DIM = '#6a6a6a';
const ACCENT = '#f0a070'; // orange used in their email banner & highlight rings
const ACCENT_HOT = '#ff5b5b'; // red diff marks
const SELECTED = '#7c5cff'; // purple-ish "After" tile outline

// ── Shell ─────────────────────────────────────────────────────────

const Shell = styled.div({
  fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
  background: BG,
  color: TEXT,
  width: '100vw',
  height: '100vh',
  display: 'grid',
  gridTemplateRows: '44px 1fr',
  gridTemplateColumns: 'minmax(420px, 46%) 1fr',
  gridTemplateAreas: `
    "tabs tabs"
    "left right"
  `,
  overflow: 'hidden',
  fontSize: 13,
});

const Tabs = styled.div({
  gridArea: 'tabs',
  background: BG,
  borderBottom: `1px solid ${BORDER}`,
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 4,
});

const Tab = styled.button<{ active: boolean }>(({ active }) => ({
  background: 'transparent',
  border: 'none',
  borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
  color: active ? TEXT : DIM,
  padding: '13px 12px 11px',
  fontSize: 12.5,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
  '&:hover': { color: TEXT },
}));

const TabRight = styled.div({
  marginLeft: 'auto',
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  fontSize: 11,
  color: DIM,
});

// ── Left pane ─────────────────────────────────────────────────────

const Left = styled.aside({
  gridArea: 'left',
  background: BG,
  borderRight: `1px solid ${BORDER_2}`,
  overflowY: 'auto',
  padding: '8px 0',
});

const RouteRow = styled.div({
  padding: '8px 16px 4px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  color: TEXT,
});

const RouteToggle = styled.button({
  background: 'transparent',
  border: 'none',
  color: DIM,
  cursor: 'pointer',
  fontSize: 11,
  width: 16,
  padding: 0,
});

const RoutePath = styled.span({
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  fontWeight: 500,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
});

const VariantBadges = styled.div({
  display: 'flex',
  gap: 4,
});

const VariantBadge = styled.span({
  background: PANEL_2,
  border: `1px solid ${BORDER}`,
  color: TEXT,
  borderRadius: 4,
  padding: '1px 7px',
  fontSize: 11,
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  fontWeight: 500,
});

const MoreBadge = styled.span({
  background: PANEL_2,
  border: `1px solid ${BORDER}`,
  color: DIM,
  borderRadius: 4,
  padding: '1px 7px',
  fontSize: 11,
  fontWeight: 500,
});

const ThumbGrid = styled.div({
  padding: '8px 16px 16px',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 10,
});

const ThumbBox = styled.button<{ selected?: boolean }>(({ selected }) => ({
  position: 'relative' as const,
  border: `2px solid ${selected ? SELECTED : 'transparent'}`,
  borderRadius: 4,
  background: PANEL_2,
  padding: 0,
  cursor: 'pointer',
  aspectRatio: '16 / 11',
  overflow: 'hidden',
  outline: 'none',
  transition: 'border-color 0.15s, transform 0.15s',
  '&:hover': { borderColor: selected ? SELECTED : BORDER },
}));

const ThumbInner = styled.div({
  position: 'absolute' as const,
  inset: 0,
  display: 'flex',
  flexDirection: 'column' as const,
});

const ThumbBanner = styled.div({
  background: ACCENT,
  height: 5,
  flexShrink: 0,
});

const ThumbFrame = styled.iframe({
  border: 'none',
  background: '#fff',
  pointerEvents: 'none' as const,
  // Scale the iframe down so 2x rendered content fits 1x card size —
  // gives readable thumbnails without paying for tiny re-renders.
  width: '200%',
  height: '200%',
  transform: 'scale(0.5)',
  transformOrigin: 'top left',
});

const ThumbCount = styled.span({
  position: 'absolute' as const,
  bottom: 4,
  right: 4,
  background: 'rgba(0,0,0,0.78)',
  color: TEXT,
  fontSize: 10,
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 3,
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
});

const ViewAllTile = styled.button({
  background: PANEL_2,
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  color: TEXT,
  cursor: 'pointer',
  aspectRatio: '16 / 11',
  fontSize: 12,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  '&:hover': { background: PANEL },
});

// ── Right pane ────────────────────────────────────────────────────

const Right = styled.section({
  gridArea: 'right',
  background: BG,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
  padding: 16,
  gap: 12,
});

const BigPreview = styled.div({
  flex: 1,
  position: 'relative' as const,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  overflow: 'hidden',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column' as const,
});

const VerifyBanner = styled.div({
  background: ACCENT,
  color: '#1a1100',
  fontSize: 12,
  fontWeight: 500,
  textAlign: 'center' as const,
  padding: '6px 12px',
  flexShrink: 0,
});

const FrameWrap = styled.div({
  flex: 1,
  position: 'relative' as const,
  background: '#fff',
});

const BigFrame = styled.iframe({
  width: '100%',
  height: '100%',
  border: 'none',
  display: 'block',
});

const HighlightRing = styled.div<{ top: string; left: string; w: string; h: string }>(
  ({ top, left, w, h }) => ({
    position: 'absolute' as const,
    top,
    left,
    width: w,
    height: h,
    border: `2.5px solid ${ACCENT}`,
    borderRadius: '50%',
    boxShadow: '0 0 0 1.5px rgba(240, 160, 112, 0.35)',
    pointerEvents: 'none' as const,
    animation: 'ringPulse 2.4s ease-in-out infinite',
    '@keyframes ringPulse': {
      '0%, 100%': { opacity: 0.85, transform: 'scale(1)' },
      '50%': { opacity: 1, transform: 'scale(1.04)' },
    },
  })
);

const SubVariants = styled.div({
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 8,
});

const SubLabel = styled.div({
  textAlign: 'center' as const,
  fontSize: 14,
  fontWeight: 600,
  color: TEXT,
});

const SubStrip = styled.div({
  display: 'flex',
  gap: 12,
  justifyContent: 'center',
});

const SubThumb = styled.button<{ selected?: boolean }>(({ selected }) => ({
  width: 280,
  height: 130,
  border: `2px solid ${selected ? SELECTED : 'transparent'}`,
  borderRadius: 4,
  background: PANEL_2,
  padding: 0,
  cursor: 'pointer',
  overflow: 'hidden',
  position: 'relative' as const,
  '&:hover': { borderColor: selected ? SELECTED : BORDER },
}));

// ── Changes-mode bits ─────────────────────────────────────────────

const ChangesHeader = styled.div({
  padding: '12px 16px',
  borderBottom: `1px solid ${BORDER_2}`,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 12,
  color: DIM,
});

const Radio = styled.label<{ active: boolean }>(({ active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  color: active ? TEXT : DIM,
  '&::before': {
    content: '""',
    display: 'inline-block',
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: `2px solid ${active ? ACCENT : VERY_DIM}`,
    background: active ? ACCENT : 'transparent',
    boxShadow: active ? `inset 0 0 0 3px ${BG}` : 'none',
  },
}));

const ChangeSection = styled.div<{ highlighted?: boolean }>(({ highlighted }) => ({
  padding: '14px 16px 18px',
  borderBottom: `1px solid ${BORDER_2}`,
  background: highlighted ? 'rgba(240, 160, 112, 0.04)' : 'transparent',
  border: highlighted ? `1.5px solid ${ACCENT}` : undefined,
  borderRadius: highlighted ? 8 : 0,
  margin: highlighted ? '12px 12px 0' : 0,
}));

const ChangeTitle = styled.h3({
  margin: '0 0 12px',
  fontSize: 16,
  fontWeight: 600,
  color: TEXT,
});

const ChangeGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 10,
});

const ChangeThumb = styled.button<{ selected?: boolean; label?: string }>(({ selected }) => ({
  position: 'relative' as const,
  aspectRatio: '16 / 11',
  border: `2px solid ${selected ? SELECTED : 'transparent'}`,
  borderRadius: 4,
  overflow: 'hidden',
  background: PANEL_2,
  cursor: 'pointer',
  padding: 0,
  '&:hover': { borderColor: selected ? SELECTED : BORDER },
}));

const AfterLabel = styled.span({
  position: 'absolute' as const,
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  background: 'rgba(13, 6, 20, 0.55)',
  pointerEvents: 'none' as const,
});

const RedDiff = styled.span({
  position: 'absolute' as const,
  bottom: 6,
  left: 6,
  right: 6,
  height: 3,
  background: ACCENT_HOT,
  borderRadius: 999,
  pointerEvents: 'none' as const,
});

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

interface FlatRow {
  cluster: MockCluster;
  story: MockStory;
  letter: string;
}

export function MeticulousV2Review({
  data,
  initialStoryId,
  initialMode = 'tests',
}: MeticulousV2ReviewProps) {
  const allFlat = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    for (const c of data.clusters) {
      c.sampleStories.forEach((s, i) => {
        out.push({ cluster: c, story: s, letter: String.fromCharCode(65 + i) });
      });
    }
    return out;
  }, [data.clusters]);

  const [mode, setMode] = useState<'tests' | 'changes'>(initialMode);
  const [activeId, setActiveId] = useState<string>(
    initialStoryId ?? allFlat[0]?.story.storyId ?? ''
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(data.clusters.map((c) => c.id))
  );
  const [grouping, setGrouping] = useState<'html-diff' | 'urls' | 'user-flow'>('html-diff');

  const activeRow = useMemo(
    () => allFlat.find((r) => r.story.storyId === activeId) ?? allFlat[0],
    [allFlat, activeId]
  );
  const subVariants = activeRow
    ? activeRow.cluster.sampleStories.filter((s) => s.storyId !== activeRow.story.storyId)
    : [];

  const toggleRoute = (id: string) => {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <Shell>
      <Tabs>
        <Tab active={mode === 'tests'} onClick={() => setMode('tests')}>
          Tests · {allFlat.length}
        </Tab>
        <Tab active={mode === 'changes'} onClick={() => setMode('changes')}>
          Changes · {data.clusters.length}
        </Tab>
        <TabRight>
          <span style={{ color: TEXT, fontWeight: 600 }}>{data.changedFile}</span>
          <span>·</span>
          <span>{data.cascadeSize} screens tested</span>
        </TabRight>
      </Tabs>

      {mode === 'tests' && (
        <>
          <Left>
            {data.clusters.map((cluster) => {
              const isOpen = expanded.has(cluster.id);
              const stories = cluster.sampleStories;
              const truncated = cluster.totalStoryCount > stories.length;
              const visibleCount = truncated ? stories.length - 1 : stories.length;
              const visible = truncated ? stories.slice(0, visibleCount) : stories;
              const variantLetters = stories.slice(0, 3).map((_, i) => String.fromCharCode(65 + i));
              const extraLetters = stories.length - 3;
              return (
                <React.Fragment key={cluster.id}>
                  <RouteRow>
                    <RouteToggle onClick={() => toggleRoute(cluster.id)}>
                      {isOpen ? '⌄' : '›'}
                    </RouteToggle>
                    <RoutePath>{routeFor(cluster)}</RoutePath>
                    <VariantBadges>
                      {variantLetters.map((l) => (
                        <VariantBadge key={l}>{l}</VariantBadge>
                      ))}
                      {extraLetters > 0 && <MoreBadge>…</MoreBadge>}
                    </VariantBadges>
                  </RouteRow>
                  {isOpen && (
                    <ThumbGrid>
                      {visible.map((s, i) => (
                        <ThumbBox
                          key={s.storyId}
                          selected={s.storyId === activeId}
                          title={`${s.title} / ${s.name}`}
                          onClick={() => setActiveId(s.storyId)}
                        >
                          <LazyThumbFrame
                            storyId={s.storyId}
                            title={s.title}
                            subtitle={s.name}
                            decorations={<ThumbBanner />}
                            style={{ position: 'absolute', inset: 0 }}
                          />
                          <ThumbCount>
                            {cluster.totalStoryCount - stories.length + i + 1}
                          </ThumbCount>
                        </ThumbBox>
                      ))}
                      {truncated && <ViewAllTile>🖼 View all {cluster.totalStoryCount}</ViewAllTile>}
                    </ThumbGrid>
                  )}
                </React.Fragment>
              );
            })}
          </Left>

          <Right>
            {activeRow ? (
              <>
                <BigPreview>
                  <VerifyBanner>
                    ✉ Verify your email address to guarantee the best email and calendar
                    deliverability.{' '}
                    <span
                      style={{ color: '#1a1100', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Resend email
                    </span>
                  </VerifyBanner>
                  <FrameWrap>
                    <BigFrame
                      title={activeRow.story.storyId}
                      src={`/iframe.html?id=${encodeURIComponent(activeRow.story.storyId)}&viewMode=story`}
                    />
                  </FrameWrap>
                </BigPreview>
                {subVariants.length > 0 && (
                  <SubVariants>
                    <SubLabel>And sub-variants {subVariants.length} tested</SubLabel>
                    <SubStrip>
                      {subVariants.slice(0, 3).map((s) => (
                        <SubThumb
                          key={s.storyId}
                          onClick={() => setActiveId(s.storyId)}
                          title={`${s.title} / ${s.name}`}
                        >
                          <LazyThumbFrame
                            storyId={s.storyId}
                            title={s.title}
                            subtitle={s.name}
                            decorations={<ThumbBanner />}
                            style={{ position: 'absolute', inset: 0 }}
                          />
                        </SubThumb>
                      ))}
                    </SubStrip>
                  </SubVariants>
                )}
              </>
            ) : (
              <div style={{ padding: 40, color: DIM, fontSize: 14 }}>No selection.</div>
            )}
          </Right>
        </>
      )}

      {mode === 'changes' && (
        <>
          <Left>
            <ChangesHeader>
              <span>Grouping</span>
              <Radio active={grouping === 'html-diff'} onClick={() => setGrouping('html-diff')}>
                HTML Diff
              </Radio>
              <Radio active={grouping === 'urls'} onClick={() => setGrouping('urls')}>
                URLs
              </Radio>
              <Radio active={grouping === 'user-flow'} onClick={() => setGrouping('user-flow')}>
                User Flow
              </Radio>
            </ChangesHeader>
            {data.clusters.map((cluster, idx) => {
              const isActive = cluster.id === activeRow?.cluster.id;
              const stories = cluster.sampleStories;
              return (
                <ChangeSection key={cluster.id} highlighted={isActive}>
                  <ChangeTitle>Change #{idx + 1}</ChangeTitle>
                  <ChangeGrid>
                    {stories.slice(0, 5).map((s) => {
                      const isActiveStory = s.storyId === activeId;
                      return (
                        <ChangeThumb
                          key={s.storyId}
                          selected={isActiveStory && isActive}
                          onClick={() => setActiveId(s.storyId)}
                          title={`${s.title} / ${s.name}`}
                        >
                          <LazyThumbFrame
                            storyId={s.storyId}
                            title={s.title}
                            subtitle={s.name}
                            decorations={<ThumbBanner />}
                            style={{ position: 'absolute', inset: 0 }}
                          />
                          {isActiveStory && isActive && <AfterLabel>After</AfterLabel>}
                          <RedDiff />
                        </ChangeThumb>
                      );
                    })}
                    {cluster.totalStoryCount > 5 && (
                      <ViewAllTile>🖼 View all {cluster.totalStoryCount}</ViewAllTile>
                    )}
                  </ChangeGrid>
                </ChangeSection>
              );
            })}
          </Left>

          <Right>
            {activeRow && (
              <BigPreview>
                <VerifyBanner>
                  ✉ Verify your email address to guarantee the best email and calendar
                  deliverability.{' '}
                  <span
                    style={{ color: '#1a1100', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Resend email
                  </span>
                </VerifyBanner>
                <FrameWrap>
                  <BigFrame
                    title={activeRow.story.storyId}
                    src={`/iframe.html?id=${encodeURIComponent(activeRow.story.storyId)}&viewMode=story`}
                  />
                  <HighlightRing top="34%" left="44%" w="170px" h="60px" />
                </FrameWrap>
              </BigPreview>
            )}
          </Right>
        </>
      )}
    </Shell>
  );
}

function routeFor(cluster: MockCluster): string {
  // Map cluster ids to faux URL paths to match Meticulous's route tree.
  // (real version would come from the agent's clustering of URLs.)
  const id = cluster.id;
  if (id === 'direct-button-importers') return '/components/button/[variant]';
  if (id === 'docs-blocks-direct') return '/docs/blocks/[name]';
  if (id === 'overlay-consumers') return '/overlay/[type]';
  if (id === 'select-tabs-toolbar') return '/components/[interactive]';
  if (id === 'manager-transitive') return '/manager/[surface]';
  if (id === 'remaining-consumers') return '/[catch-all]';
  if (id === 'manager-layout-pages') return '/manager/layout/[mode]';
  if (id === 'onboarding-pages') return '/onboarding/[step]';
  if (id === 'single-coherent-cluster') return '/[everything]';
  return `/${id.replace(/-/g, '/')}`;
}
