import {
  iframeResizeDimensionsEqual,
  type IframeResizeDimensions,
} from '../../../../shared/constants/iframe-resize.ts';

/**
 * Lifecycle of one review thumbnail cell:
 *
 * - `idle`: not near the viewport; nothing rendered
 * - `queued`: waiting for a scheduler concurrency slot; spinner shown
 * - `booting`: slot granted, iframe src assigned; waiting for iframe.resize
 * - `measured`: content dimensions arrived; waiting for the new scale to paint
 * - `settled`: scale painted (or the fallback deadline passed); spinner hidden
 *
 * Eviction returns any phase to `idle`.
 */
export type ThumbnailPhase = 'idle' | 'queued' | 'booting' | 'measured' | 'settled';

export type ThumbnailState = {
  phase: ThumbnailPhase;
  src: string | undefined;
  dimensions: IframeResizeDimensions | null;
  /** Increments per boot (src assignment); keys the spinner fallback deadline. */
  bootId: number;
};

export type ThumbnailEvent =
  | { type: 'enqueued' }
  | { type: 'started'; src: string }
  | { type: 'resized'; dimensions: IframeResizeDimensions }
  | { type: 'settled' }
  | { type: 'evicted' };

export const initialThumbnailState: ThumbnailState = {
  phase: 'idle',
  src: undefined,
  dimensions: null,
  bootId: 0,
};

/** The spinner covers the frame from enqueue until the measured scale has painted. */
export const isThumbnailLoading = ({ phase }: ThumbnailState): boolean =>
  phase === 'queued' || phase === 'booting' || phase === 'measured';

export const thumbnailReducer = (state: ThumbnailState, event: ThumbnailEvent): ThumbnailState => {
  switch (event.type) {
    case 'enqueued':
      // Keep the old src: the previous iframe stays mounted (hidden behind the
      // spinner) until the scheduler grants a slot and swaps it out.
      return { ...state, phase: 'queued', dimensions: null };

    case 'started':
      if (state.phase !== 'queued') {
        return state;
      }
      return { ...state, phase: 'booting', src: event.src, bootId: state.bootId + 1 };

    case 'resized': {
      if (state.phase === 'booting' || state.phase === 'measured') {
        const unchanged = iframeResizeDimensionsEqual(state.dimensions, event.dimensions);
        if (state.phase === 'measured' && unchanged) {
          return state;
        }
        return {
          ...state,
          phase: 'measured',
          dimensions: unchanged ? state.dimensions : event.dimensions,
        };
      }
      if (state.phase === 'settled') {
        // Late re-measures update the scale but never re-show the spinner.
        return iframeResizeDimensionsEqual(state.dimensions, event.dimensions)
          ? state
          : { ...state, dimensions: event.dimensions };
      }
      // idle/queued: stale message from an evicted or superseded iframe.
      return state;
    }

    case 'settled':
      // From `booting` this is the fallback deadline (no resize ever arrived);
      // ignored in other phases (stale rAF or timer).
      if (state.phase === 'booting' || state.phase === 'measured') {
        return { ...state, phase: 'settled' };
      }
      return state;

    case 'evicted':
      if (state.phase === 'idle') {
        return state;
      }
      return { ...initialThumbnailState, bootId: state.bootId };
  }
};
