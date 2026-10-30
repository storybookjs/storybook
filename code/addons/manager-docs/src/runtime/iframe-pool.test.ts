import { describe, expect, it } from 'vitest';

import { nextFrameId, planViewportPool } from './iframe-pool.ts';

describe('planViewportPool', () => {
  it('mounts one new frame per visible instance when none are seated', () => {
    expect(planViewportPool([], ['a', 'b'])).toEqual({
      assignments: [
        { frameId: 'frame-1', instanceId: 'a', reused: false },
        { frameId: 'frame-2', instanceId: 'b', reused: false },
      ],
      dropFrameIds: [],
    });
  });

  it('reuses a leaving frame for an entering instance', () => {
    expect(planViewportPool([{ frameId: 'frame-1', occupantId: 'a' }], ['b'])).toEqual({
      assignments: [{ frameId: 'frame-1', instanceId: 'b', reused: true }],
      dropFrameIds: [],
    });
  });

  it('keeps a still-visible occupant and mounts another frame for the extra visible instance', () => {
    expect(planViewportPool([{ frameId: 'frame-1', occupantId: 'a' }], ['a', 'b'])).toEqual({
      assignments: [
        { frameId: 'frame-1', instanceId: 'a', reused: false },
        { frameId: 'frame-2', instanceId: 'b', reused: false },
      ],
      dropFrameIds: [],
    });
  });

  it('drops a frame that is no longer on screen', () => {
    expect(
      planViewportPool(
        [
          { frameId: 'frame-1', occupantId: 'a' },
          { frameId: 'frame-2', occupantId: 'b' },
        ],
        ['b']
      )
    ).toEqual({
      assignments: [{ frameId: 'frame-2', instanceId: 'b', reused: false }],
      dropFrameIds: ['frame-1'],
    });
  });

  it('does not treat an empty spare as a reuse', () => {
    expect(planViewportPool([{ frameId: 'frame-1', occupantId: null }], ['a'])).toEqual({
      assignments: [{ frameId: 'frame-1', instanceId: 'a', reused: false }],
      dropFrameIds: [],
    });
  });
});

describe('nextFrameId', () => {
  it('skips ids that are already mounted', () => {
    expect(nextFrameId(['frame-1', 'frame-3'])).toBe('frame-2');
  });
});
