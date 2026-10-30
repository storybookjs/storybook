import { describe, expect, it } from 'vitest';

import {
  applySessionEvent,
  assignOccupant,
  attachChannel,
  createIframeHost,
  createSession,
  mountInstance,
  reuseInstance,
  setHeight,
  setPlay,
  updateArgs,
  updateGlobals,
} from './iframe-session.ts';

const story = 'button--primary';

describe('iframe sessions', () => {
  it('does not leak args, globals, or play state when a frame is reused', () => {
    const originalArgs = { label: 'A' };
    let host = mountInstance(createIframeHost(), 'frame-a', {
      instanceId: 'a',
      storyId: story,
      args: originalArgs,
      globals: { theme: 'dark' },
    });
    host = mountInstance(host, 'frame-b', {
      instanceId: 'b',
      storyId: story,
      args: { label: 'B' },
      globals: { theme: 'light' },
    });
    host = {
      sessions: host.sessions.map((session) =>
        session.frameId === 'frame-a'
          ? setHeight(setPlay(session, 'a', 'running'), 'a', 240)
          : session
      ),
    };

    originalArgs.label = 'mutated';
    host = reuseInstance(host, 'frame-a', {
      instanceId: 'c',
      storyId: story,
      args: { label: 'C' },
      globals: { locale: 'fr' },
    });

    const reused = host.sessions.find((session) => session.frameId === 'frame-a');
    const neighbor = host.sessions.find((session) => session.frameId === 'frame-b');
    expect(reused?.occupant).toEqual({
      instanceId: 'c',
      storyId: story,
      args: { label: 'C' },
      argsFromIndex: false,
      globals: { locale: 'fr' },
      play: 'idle',
      height: null,
      generation: 2,
      search: 'id=button--primary&viewMode=story&managerDocsInstance=c',
    });
    expect(neighbor?.occupant).toMatchObject({
      instanceId: 'b',
      args: { label: 'B' },
      globals: { theme: 'light' },
      play: 'idle',
      height: null,
    });

    const late = applySessionEvent(reused!, {
      instanceId: 'a',
      generation: 1,
      args: { label: 'LEAK' },
      globals: { theme: 'dark' },
      play: 'running',
      height: 240,
    });
    expect(late.applied).toBe(false);
    expect(late.session.occupant).toEqual(reused?.occupant);
  });

  it('refuses to assign a new occupant until the session is reset', () => {
    const occupied = assignOccupant(attachChannel(createSession('frame-a')), {
      instanceId: 'a',
      storyId: story,
      args: { label: 'A' },
      globals: {},
    });

    expect(() =>
      assignOccupant(occupied, { instanceId: 'b', storyId: story, args: {}, globals: {} })
    ).toThrow(/Reset/);
    expect(() => updateArgs(occupied, 'b', { label: 'nope' })).toThrow(/not occupied/);
    expect(updateGlobals(occupied, 'a', { theme: 'dark' }).occupant?.globals).toEqual({
      theme: 'dark',
    });
    expect(occupied.occupant?.globals).toEqual({});
  });

  it('does not record a negative height for the occupant', () => {
    const occupied = assignOccupant(attachChannel(createSession('frame-a')), {
      instanceId: 'a',
      storyId: story,
      args: { label: 'A' },
      globals: { theme: 'dark' },
    });
    const measured = setHeight(occupied, 'a', 40);
    const rejected = applySessionEvent(measured, {
      instanceId: 'a',
      generation: measured.occupant?.generation ?? 0,
      height: -1,
      play: 'running',
    });

    expect(rejected.applied).toBe(false);
    expect(rejected.session.occupant).toMatchObject({
      args: { label: 'A' },
      globals: { theme: 'dark' },
      play: 'idle',
      height: 40,
    });
    expect(() => setHeight(occupied, 'a', -1)).toThrow(/height/i);
  });
});
