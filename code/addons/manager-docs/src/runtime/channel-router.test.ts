import { describe, expect, it } from 'vitest';

import { MAIN_CANVAS_ID } from '../constants.ts';
import {
  createChannelState,
  dispatchInstanceEvent,
  registerInstance,
  unregisterInstance,
} from './channel-router.ts';

const first = 'button--primary#1';
const second = 'button--primary#2';

function twoInstances() {
  return registerInstance(
    registerInstance(
      createChannelState(),
      first,
      'button--primary',
      { label: 'One' },
      { theme: 'light' }
    ),
    second,
    'button--primary',
    { label: 'Two' },
    { theme: 'light' }
  );
}

describe('registerInstance', () => {
  it('refuses a duplicate id but registers it again after unregistering', () => {
    const state = twoInstances();
    expect(() => registerInstance(state, first, 'button--primary', {}, {})).toThrow(
      /already registered/
    );

    const removed = unregisterInstance(state, first);
    expect(Object.keys(removed.instances)).toEqual([second]);
    expect(
      dispatchInstanceEvent(removed, { kind: 'args', instanceId: first, args: {} }).decision
    ).toEqual({ status: 'reject', reason: 'unknown-instance' });

    const again = registerInstance(removed, first, 'button--primary', { label: 'Fresh' }, {});
    expect(again.instances[first]).toEqual({
      storyId: 'button--primary',
      args: { label: 'Fresh' },
      globals: {},
      height: null,
      play: null,
    });
    expect(again.instances[second]?.args).toEqual({ label: 'Two' });
  });

  it('ignores unregistering an id that is not registered', () => {
    const state = twoInstances();

    expect(unregisterInstance(state, 'missing')).toBe(state);
  });
});

describe('dispatchInstanceEvent', () => {
  it('does not let two instances of the same story share args, globals, height, or play', () => {
    const state = twoInstances();

    const args = dispatchInstanceEvent(state, {
      kind: 'args',
      instanceId: first,
      storyId: 'button--primary',
      args: { label: 'Edited' },
    });
    expect(args.decision).toEqual({ status: 'deliver', instanceId: first });
    expect(args.state.instances[first]?.args).toEqual({ label: 'Edited' });
    expect(args.state.instances[second]?.args).toEqual({ label: 'Two' });

    const globals = dispatchInstanceEvent(args.state, {
      kind: 'globals',
      instanceId: first,
      globals: { theme: 'dark', viewport: 'mobile' },
    });
    expect(globals.state.instances[first]?.globals).toEqual({ theme: 'dark', viewport: 'mobile' });
    expect(globals.state.instances[second]?.globals).toEqual({ theme: 'light' });

    const height = dispatchInstanceEvent(globals.state, {
      kind: 'height',
      instanceId: second,
      height: 180,
    });
    expect(height.state.instances[second]?.height).toBe(180);
    expect(height.state.instances[first]?.height).toBeNull();

    const play = dispatchInstanceEvent(height.state, {
      kind: 'play',
      instanceId: first,
      phase: 'start',
    });
    expect(play.state.instances[first]?.play).toBe('start');
    expect(play.state.instances[second]?.play).toBeNull();
  });

  it('rejects events that are not addressed to one registered instance', () => {
    const state = twoInstances();

    expect(
      dispatchInstanceEvent(state, {
        kind: 'args',
        storyId: 'button--primary',
        args: { label: 'x' },
      })
    ).toEqual({
      state,
      decision: { status: 'reject', reason: 'missing-instance' },
    });
    expect(
      dispatchInstanceEvent(state, { kind: 'globals', instanceId: MAIN_CANVAS_ID, globals: {} })
        .decision
    ).toEqual({
      status: 'reject',
      reason: 'main-canvas',
    });
    expect(
      dispatchInstanceEvent(state, { kind: 'args', instanceId: 'missing', args: {} }).decision
    ).toEqual({ status: 'reject', reason: 'unknown-instance' });
    expect(
      dispatchInstanceEvent(state, {
        kind: 'args',
        instanceId: first,
        storyId: 'other--story',
        args: { label: 'x' },
      }).decision
    ).toEqual({ status: 'reject', reason: 'foreign-story' });
    expect(state.instances[first]?.args).toEqual({ label: 'One' });
    expect(state.instances[second]?.args).toEqual({ label: 'Two' });
  });

  it('rejects a negative height without writing either instance', () => {
    const state = twoInstances();
    const result = dispatchInstanceEvent(state, {
      kind: 'height',
      instanceId: first,
      height: -1,
    });

    expect(result.decision).toEqual({ status: 'reject', reason: 'invalid-height' });
    expect(result.state.instances[first]?.height).toBeNull();
    expect(result.state.instances[second]?.height).toBeNull();
  });
});
