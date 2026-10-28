import { describe, expect, it } from 'vitest';

import {
  initialThumbnailState,
  isThumbnailLoading,
  thumbnailReducer,
  type ThumbnailEvent,
  type ThumbnailState,
} from './previewThumbnailState.ts';

const run = (events: ThumbnailEvent[], from: ThumbnailState = initialThumbnailState) =>
  events.reduce(thumbnailReducer, from);

const dimensions = { width: 320, height: 240 };
const otherDimensions = { width: 640, height: 480 };

describe('thumbnailReducer', () => {
  it('walks the happy path idle → queued → booting → measured → settled', () => {
    let state = initialThumbnailState;
    expect(isThumbnailLoading(state)).toBe(false);

    state = thumbnailReducer(state, { type: 'enqueued' });
    expect(state.phase).toBe('queued');
    expect(state.src).toBeUndefined();
    expect(isThumbnailLoading(state)).toBe(true);

    state = thumbnailReducer(state, { type: 'started', src: 'iframe.html?id=a' });
    expect(state.phase).toBe('booting');
    expect(state.src).toBe('iframe.html?id=a');
    expect(state.dimensions).toBeNull();
    expect(isThumbnailLoading(state)).toBe(true);

    state = thumbnailReducer(state, { type: 'resized', dimensions });
    expect(state.phase).toBe('measured');
    expect(state.dimensions).toEqual(dimensions);
    expect(isThumbnailLoading(state)).toBe(true);

    state = thumbnailReducer(state, { type: 'settled' });
    expect(state.phase).toBe('settled');
    expect(state.dimensions).toEqual(dimensions);
    expect(isThumbnailLoading(state)).toBe(false);
  });

  it('settles from booting when the fallback deadline passes without a resize', () => {
    const state = run([{ type: 'enqueued' }, { type: 'started', src: 'a' }, { type: 'settled' }]);
    expect(state.phase).toBe('settled');
    expect(state.dimensions).toBeNull();
  });

  it('updates dimensions on late resizes without re-showing the spinner', () => {
    const settled = run([
      { type: 'enqueued' },
      { type: 'started', src: 'a' },
      { type: 'resized', dimensions },
      { type: 'settled' },
    ]);
    const state = thumbnailReducer(settled, { type: 'resized', dimensions: otherDimensions });
    expect(state.phase).toBe('settled');
    expect(state.dimensions).toEqual(otherDimensions);
    expect(isThumbnailLoading(state)).toBe(false);
  });

  it('ignores duplicate resize payloads once settled', () => {
    const settled = run([
      { type: 'enqueued' },
      { type: 'started', src: 'a' },
      { type: 'resized', dimensions },
      { type: 'settled' },
    ]);
    expect(thumbnailReducer(settled, { type: 'resized', dimensions: { ...dimensions } })).toBe(
      settled
    );
  });

  it('keeps state identity for equal-dimension resizes while measured', () => {
    const measured = run([
      { type: 'enqueued' },
      { type: 'started', src: 'a' },
      { type: 'resized', dimensions },
    ]);
    expect(thumbnailReducer(measured, { type: 'resized', dimensions: { ...dimensions } })).toBe(
      measured
    );
  });

  it('ignores stale resize and settled events while idle or queued', () => {
    expect(thumbnailReducer(initialThumbnailState, { type: 'resized', dimensions })).toBe(
      initialThumbnailState
    );
    expect(thumbnailReducer(initialThumbnailState, { type: 'settled' })).toBe(
      initialThumbnailState
    );
    const queued = run([{ type: 'enqueued' }]);
    expect(thumbnailReducer(queued, { type: 'resized', dimensions })).toBe(queued);
    expect(thumbnailReducer(queued, { type: 'settled' })).toBe(queued);
  });

  it('ignores started unless queued', () => {
    const settled = run([{ type: 'enqueued' }, { type: 'started', src: 'a' }, { type: 'settled' }]);
    expect(thumbnailReducer(settled, { type: 'started', src: 'b' })).toBe(settled);
  });

  it('evicts any phase back to idle, clearing src and dimensions', () => {
    const settled = run([
      { type: 'enqueued' },
      { type: 'started', src: 'a' },
      { type: 'resized', dimensions },
      { type: 'settled' },
    ]);
    const state = thumbnailReducer(settled, { type: 'evicted' });
    expect(state.phase).toBe('idle');
    expect(state.src).toBeUndefined();
    expect(state.dimensions).toBeNull();
    expect(isThumbnailLoading(state)).toBe(false);
    expect(thumbnailReducer(state, { type: 'evicted' })).toBe(state);
  });

  it('re-enqueues a settled cell keeping the old src but dropping stale dimensions', () => {
    const settled = run([
      { type: 'enqueued' },
      { type: 'started', src: 'a' },
      { type: 'resized', dimensions },
      { type: 'settled' },
    ]);
    const state = thumbnailReducer(settled, { type: 'enqueued' });
    expect(state.phase).toBe('queued');
    expect(state.src).toBe('a');
    expect(state.dimensions).toBeNull();
    expect(isThumbnailLoading(state)).toBe(true);
  });

  it('increments bootId on every start, surviving eviction', () => {
    const first = run([{ type: 'enqueued' }, { type: 'started', src: 'a' }]);
    expect(first.bootId).toBe(1);
    const second = run(
      [{ type: 'evicted' }, { type: 'enqueued' }, { type: 'started', src: 'a' }],
      first
    );
    expect(second.bootId).toBe(2);
  });
});
