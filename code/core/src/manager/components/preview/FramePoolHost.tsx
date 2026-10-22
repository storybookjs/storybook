import React, { useEffect, useRef } from 'react';

import type { API, State } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { FRAME_POOL_PARAM, getFramePoolOptions } from '../../../shared/constants/frame-pool.ts';
import { FramePool, type FramePoolEntry } from './FramePool.ts';

const Container = styled.div(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: theme.background.preview,
}));

let pool: FramePool | undefined;

/**
 * The URL of a new frame of the pool, which boots on `entry`. Only the selected story gets the args
 * of the manager's URL, which are the selected story's.
 */
export const framePoolSrc = (
  api: Pick<API, 'getStoryHrefs'>,
  { queryParams = {}, version }: { queryParams?: State['customQueryParams']; version?: string },
  entry: FramePoolEntry,
  { autoplay, selected }: { autoplay: boolean; selected: boolean }
) => {
  const { args: _args, ...params } = queryParams;
  return api.getStoryHrefs(entry.id, {
    queryParams: {
      ...params,
      ...(version && { version }),
      [FRAME_POOL_PARAM]: 'frame',
      ...(!autoplay && { autoplay: 'false' }),
    },
    ...(!selected && { inheritArgs: false }),
    refId: undefined,
    viewMode: entry.viewMode,
  }).previewHref;
};

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
    max: globalThis.matchMedia?.('(max-width: 600px)').matches ? options.mobileMax : options.max,
    src: (entry, options) => framePoolSrc(api, latest.current, entry, options),
    userGlobals: () => api.getUserGlobals() ?? {},
    hasPlay: (storyId) => !!api.getData(storyId)?.tags?.includes('play-fn'),
    firstStory: () =>
      Object.values(api.getIndex()?.entries ?? {}).find((entry) => entry.type === 'story')?.id,
    receive: (event) => api.getChannel()?.receive(event),
  });
  return pool;
};

/**
 * Where the pool's host lies. The pool owns the host and its frames, and React never renders into
 * it, so it never moves them.
 */
export const FramePoolHost = ({ pool: framePool }: { pool: FramePool }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      framePool.attach(ref.current);
    }
  }, [framePool]);
  return <Container ref={ref} />;
};
