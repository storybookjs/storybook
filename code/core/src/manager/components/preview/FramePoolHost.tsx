import React, { useEffect, useRef } from 'react';

import type { API, State } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { FRAME_POOL_PARAM, getFramePoolOptions } from '../../../shared/constants/frame-pool.ts';
import { FramePool } from './FramePool.ts';

const Host = styled.div(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflowX: 'hidden',
  overflowY: 'hidden',
  backgroundColor: theme.background.preview,
}));

let pool: FramePool | undefined;

/**
 * The manager's pool of preview frames, with `features.experimentalFramePool` on. The first call
 * creates it, and it lives as long as the manager.
 */
export const useFramePool = (
  api: API,
  queryParams: State['customQueryParams'],
  version: string | undefined
): FramePool | undefined => {
  const latest = useRef({ queryParams, version });
  latest.current = { queryParams, version };
  const options = getFramePoolOptions(globalThis.FEATURES?.experimentalFramePool);
  if (!options || typeof document === 'undefined') {
    return undefined;
  }
  pool ??= new FramePool({
    size: options.size,
    // On a phone few stories fit the screen, and little memory the page.
    max: globalThis.matchMedia?.('(max-width: 600px)').matches
      ? options.mobileMax
      : Number.POSITIVE_INFINITY,
    src: (entry, { autoplay, selected }) =>
      api.getStoryHrefs(entry.id, {
        queryParams: {
          ...latest.current.queryParams,
          ...(latest.current.version && { version: latest.current.version }),
          [FRAME_POOL_PARAM]: 'frame',
          ...(!autoplay && { autoplay: 'false' }),
        },
        ...(!selected && { inheritArgs: false }),
        refId: undefined,
        viewMode: entry.viewMode,
      }).previewHref,
    userGlobals: () => api.getUserGlobals() ?? {},
    hasPlay: (storyId) => !!api.getData(storyId)?.tags?.includes('play-fn'),
    firstStory: () =>
      Object.values(api.getIndex()?.entries ?? {}).find((entry) => entry.type === 'story')?.id,
    receive: (event) => api.getChannel()?.receive(event),
  });
  return pool;
};

/** Where the frames of the pool lie: React never renders into it, so it never moves them. */
export const FramePoolHost = ({ pool: framePool }: { pool: FramePool }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      framePool.attach(ref.current);
    }
  }, [framePool]);
  return <Host ref={ref} data-storybook-frame-pool="" />;
};
