import React, { useEffect, useRef, useState } from 'react';

import {
  experimental_useStatusStore,
  useChannel,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';
import { IconButton } from 'storybook/internal/components';
import type { Status, StatusValue, StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import { ChangedIcon, CloseIcon, SideBySideIcon } from '@storybook/icons';
import { styled } from 'storybook/theming';

import { LazyStoryList, LazyMount } from './LazyStoryList.tsx';
import { StoryCard } from './StoryCard.tsx';
import { EVENTS } from '../constants.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

type StoryStatus = 'new' | 'modified' | 'affected';

interface ChangedStory {
  storyId: string;
  title: string;
  name: string;
  importPath: string;
  status: StoryStatus;
}

interface FileGroup {
  importPath: string;
  stories: ChangedStory[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHANGE_STATUS_VALUES: StatusValue[] = [
  'status-value:new',
  'status-value:modified',
  'status-value:affected',
];

function statusValueToStoryStatus(statusValue: StatusValue): StoryStatus | null {
  switch (statusValue) {
    case 'status-value:new':
      return 'new';
    case 'status-value:modified':
      return 'modified';
    case 'status-value:affected':
      return 'affected';
    default:
      return null;
  }
}

// ── Styled components ────────────────────────────────────────────────────────

const PageWrapper = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: theme.background.content,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
}));

const StickyHeader = styled.div(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  background: theme.background.content,
  flexShrink: 0,
}));

const HeaderTitle = styled.span(({ theme }) => ({
  flex: 1,
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
  color: theme.color.defaultText,
}));

const ScrollableContent = styled.div({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
});

const EmptyState = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 20,
  textAlign: 'center',
  color: theme.color.mediumdark,
  fontSize: theme.typography.size.s2,
}));

const FileGroupHeader = styled.div(({ theme }) => ({
  padding: '6px 12px',
  fontSize: theme.typography.size.s1,
  fontWeight: theme.typography.weight.bold,
  color: theme.color.mediumdark,
  background: theme.background.app,
  borderBottom: `1px solid ${theme.appBorderColor}`,
  borderTop: `1px solid ${theme.appBorderColor}`,
  wordBreak: 'break-all' as const,
}));

// ── Component ─────────────────────────────────────────────────────────────────

export const ChangesPage: React.FC = () => {
  const api = useStorybookApi();
  const state = useStorybookState();

  const lastStoryIdRef = useRef<string | undefined>(state.storyId);
  const previousIncludedFiltersRef = useRef<StatusValue[]>(state.includedStatusFilters ?? []);
  const previousExcludedFiltersRef = useRef<StatusValue[]>(state.excludedStatusFilters ?? []);
  const requestedServerRef = useRef(false);

  const [compareMode, setCompareMode] = useState(false);
  const [beforeServerPort, setBeforeServerPort] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const statuses = experimental_useStatusStore((allStatuses: StatusesByStoryIdAndTypeId) =>
    Object.fromEntries(
      Object.entries(allStatuses)
        .map(([storyId, byTypeId]) => [storyId, byTypeId[CHANGE_DETECTION_STATUS_TYPE_ID]])
        .filter(([, status]) => status != null)
    )
  );

  const emit = useChannel({
    [EVENTS.SERVER_READY]: (data: { port: number }) => {
      setBeforeServerPort(data.port);
    },
    [EVENTS.SERVER_ERROR]: () => {
      setBeforeServerPort(null);
    },
    [EVENTS.HEAD_CHANGED]: () => {
      // Increment key to force iframe remount so they re-fetch from the before-server
      setRefreshKey((k) => k + 1);
    },
  });

  // On mount: store current story + filters, set change filters, request server
  useEffect(() => {
    lastStoryIdRef.current = state.storyId;
    previousIncludedFiltersRef.current = state.includedStatusFilters ?? [];
    previousExcludedFiltersRef.current = state.excludedStatusFilters ?? [];

    api.setAllStatusFilters(CHANGE_STATUS_VALUES, []);

    if (!requestedServerRef.current) {
      requestedServerRef.current = true;
      emit(EVENTS.REQUEST_SERVER);
    }

    // Register interceptor: when in changes viewMode, scroll-to story card instead of navigating
    api.setSelectStoryInterceptor(({ storyId, viewMode }) => {
      if (viewMode === 'changes') {
        const el = document.getElementById(`changes-story-${storyId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return true; // handled — skip normal navigation
      }
      return false;
    });

    return () => {
      // On unmount: restore previous filters and clear interceptor
      api.setAllStatusFilters(
        previousIncludedFiltersRef.current,
        previousExcludedFiltersRef.current
      );
      api.clearSelectStoryInterceptor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute changed stories from status store + index
  const changedStories: ChangedStory[] = React.useMemo(() => {
    if (!statuses) return [];
    const indexEntries = api.getIndex?.()?.entries ?? {};
    const results: ChangedStory[] = [];
    for (const [storyId, storyStatus] of Object.entries(statuses) as [string, Status][]) {
      const statusValue = storyStatus.value;
      if (!CHANGE_STATUS_VALUES.includes(statusValue)) continue;
      const storyStatusShort = statusValueToStoryStatus(statusValue);
      if (!storyStatusShort) continue;
      const entry = indexEntries[storyId];
      if (!entry || entry.type !== 'story') continue;
      results.push({
        storyId,
        title: 'title' in entry ? (entry.title ?? '') : '',
        name: 'name' in entry ? (entry.name ?? '') : '',
        importPath: 'importPath' in entry ? (entry.importPath ?? '') : '',
        status: storyStatusShort,
      });
    }
    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);

  // Group by importPath
  const fileGroups: FileGroup[] = React.useMemo(() => {
    const map = new Map<string, ChangedStory[]>();
    for (const story of changedStories) {
      const key = story.importPath || story.title;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(story);
    }
    return Array.from(map.entries()).map(([importPath, stories]) => ({ importPath, stories }));
  }, [changedStories]);

  const handleExit = () => {
    // Clear the interceptor first — otherwise it blocks our own selectStory call
    // since viewMode is still 'changes' at this point.
    api.clearSelectStoryInterceptor();
    if (lastStoryIdRef.current) {
      api.selectStory(lastStoryIdRef.current);
    } else {
      api.selectFirstStory();
    }
  };

  const totalCount = changedStories.length;

  return (
    <PageWrapper>
      <StickyHeader>
        <ChangedIcon />
        <HeaderTitle>Changes ({totalCount})</HeaderTitle>
        <IconButton
          key="toggle-compare"
          title={compareMode ? 'Show after only' : 'Show before & after'}
          onClick={() => setCompareMode((prev) => !prev)}
        >
          <SideBySideIcon />
        </IconButton>
        <IconButton key="exit-changes" title="Exit changes view" onClick={handleExit}>
          <CloseIcon />
        </IconButton>
      </StickyHeader>

      <ScrollableContent>
        {totalCount === 0 ? (
          <EmptyState>No changed stories detected.</EmptyState>
        ) : (
          <LazyStoryList>
            {fileGroups.map((group) => (
              <React.Fragment key={group.importPath}>
                <FileGroupHeader>{group.importPath}</FileGroupHeader>
                {group.stories.map((story) => (
                  <LazyMount key={story.storyId}>
                    <StoryCard
                      key={`${story.storyId}-${refreshKey}`}
                      storyId={story.storyId}
                      title={story.title}
                      name={story.name}
                      importPath={story.importPath}
                      status={story.status}
                      compareMode={compareMode}
                      beforeServerPort={beforeServerPort}
                    />
                  </LazyMount>
                ))}
              </React.Fragment>
            ))}
          </LazyStoryList>
        )}
      </ScrollableContent>
    </PageWrapper>
  );
};
