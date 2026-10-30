import { describe, expect, it } from 'vitest';

import type { InstanceEvent } from './channel-router.ts';
import { createIframeHost, mountInstance, setPlay, type IframeHost } from './iframe-session.ts';
import {
  connectDocsPlays,
  createIframePlayQueue,
  startIframePlay,
  type IframePlayQueue,
} from './iframe-plays.ts';
import type { ScheduledPlay } from './play-scheduler.ts';

function withPlay(host: IframeHost, instanceId: string, play: 'running' | 'idle'): IframeHost {
  return {
    sessions: host.sessions.map((session) =>
      session.occupant?.instanceId === instanceId ? setPlay(session, instanceId, play) : session
    ),
  };
}

function readyQueue(plays: ScheduledPlay[]) {
  const queue: IframePlayQueue = createIframePlayQueue(plays);
  const started: string[] = [];
  const listeners = new Map<string, (event: InstanceEvent) => void>();
  connectDocsPlays(queue, plays, {
    listen(instanceId, listener) {
      listeners.set(instanceId, listener);
    },
    startPlay(instanceId) {
      started.push(instanceId);
    },
    pausePlay() {},
  });
  return { queue, started, listeners };
}

describe('iframe play leave', () => {
  it('releases held plays when a running focus play leaves and runs a re-entered id again', () => {
    const { queue, started, listeners } = readyQueue([
      { instanceId: 'focus', focus: true, documentOrder: 0 },
      { instanceId: 'plain', focus: false, documentOrder: 1 },
    ]);
    listeners.get('focus')?.({ kind: 'play', instanceId: 'focus', phase: 'ready' });
    listeners.get('plain')?.({ kind: 'play', instanceId: 'plain', phase: 'ready' });
    expect(started).toEqual(['focus']);

    expect(queue.leave('focus')).toEqual(['plain']);
    expect(queue.released()).toEqual(['plain']);

    queue.enter({ instanceId: 'focus', focus: false, documentOrder: 0 });
    expect(queue.bind('focus', () => started.push('focus again'))).toBe(true);
    expect(started).toEqual(['focus', 'plain', 'focus again']);
  });
});

describe('iframe play release', () => {
  it('releases two unmarked plays into their own iframes', () => {
    const started: string[] = [];
    const queue = createIframePlayQueue([
      { instanceId: 'a', focus: false, documentOrder: 0 },
      { instanceId: 'b', focus: false, documentOrder: 1 },
    ]);

    expect(queue.bind('a', () => started.push('a'))).toBe(true);
    expect(queue.bind('b', () => started.push('b'))).toBe(true);

    expect(started).toEqual(['a', 'b']);
    expect(queue.released()).toEqual(['a', 'b']);
  });

  it('holds every other play until the focus play finishes', () => {
    const started: string[] = [];
    let host = mountInstance(
      mountInstance(createIframeHost(), 'frame-plain', {
        instanceId: 'plain',
        storyId: 'button--primary',
        args: { label: 'Hello' },
        globals: { viewport: 'desktop' },
      }),
      'frame-focus',
      {
        instanceId: 'focus',
        storyId: 'button--secondary',
        args: { label: 'Bye' },
        globals: { viewport: 'desktop' },
      }
    );
    const queue = createIframePlayQueue([
      { instanceId: 'plain', focus: false, documentOrder: 0 },
      { instanceId: 'focus', focus: true, documentOrder: 1 },
    ]);

    expect(
      queue.bind('plain', () => {
        started.push('plain');
        host = withPlay(host, 'plain', 'running');
      })
    ).toBe(false);
    expect(started).toEqual([]);
    expect(queue.isReleased('plain')).toBe(false);

    expect(
      queue.bind('focus', () => {
        started.push('focus');
        host = withPlay(host, 'focus', 'running');
      })
    ).toBe(true);
    expect(started).toEqual(['focus']);
    expect(host.sessions.map((session) => session.occupant?.instanceId)).toEqual([
      'plain',
      'focus',
    ]);
    expect(host.sessions.map((session) => session.occupant?.play)).toEqual(['idle', 'running']);
    expect(() => startIframePlay(queue, 'plain', () => started.push('plain'))).toThrow(
      /before the scheduler releases it/
    );
    expect(started).toEqual(['focus']);

    expect(queue.finish('focus')).toEqual(['plain']);
    expect(started).toEqual(['focus', 'plain']);
    expect(queue.released()).toEqual(['focus', 'plain']);
  });

  it('does not let a story without a play function hold the queue', () => {
    const started: string[] = [];
    const queue = createIframePlayQueue([
      { instanceId: 'focus', focus: true, documentOrder: 0 },
      { instanceId: 'plain', focus: false, documentOrder: 1 },
    ]);

    expect(queue.bind('plain', () => started.push('plain'))).toBe(false);
    expect(queue.absent('focus')).toEqual(['plain']);
    expect(started).toEqual(['plain']);
  });

  it('still releases the other unmarked play when one callback throws', () => {
    const started: string[] = [];
    const queue = createIframePlayQueue([
      { instanceId: 'focus', focus: true, documentOrder: 0 },
      { instanceId: 'a', focus: false, documentOrder: 1 },
      { instanceId: 'b', focus: false, documentOrder: 2 },
    ]);

    queue.bind('a', () => {
      started.push('a');
      throw new Error('boom');
    });
    queue.bind('b', () => started.push('b'));
    queue.bind('focus', () => started.push('focus'));

    expect(started).toEqual(['focus']);
    expect(() => queue.finish('focus')).toThrow(/boom/);
    expect(started).toEqual(['focus', 'a', 'b']);
    expect(queue.released()).toEqual(['focus', 'a', 'b']);
    expect(() => startIframePlay(queue, 'held', () => undefined)).toThrow(
      /before the scheduler releases it/
    );
  });

  it('stops an already-released unmarked play when a focus play is entered', () => {
    const playing = new Set<string>();
    const queue = createIframePlayQueue([
      { instanceId: 'a', focus: false, documentOrder: 0 },
      { instanceId: 'b', focus: false, documentOrder: 1 },
    ]);
    const watch = (instanceId: string) => {
      queue.bind(
        instanceId,
        () => {
          playing.add(instanceId);
        },
        () => {
          playing.delete(instanceId);
        }
      );
    };

    watch('a');
    watch('b');
    expect(queue.released()).toEqual(['a', 'b']);
    expect(playing).toEqual(new Set(['a', 'b']));

    expect(queue.enter({ instanceId: 'focus', focus: true, documentOrder: 2 })).toEqual([]);
    expect(playing.has('a')).toBe(false);
    expect(playing.has('b')).toBe(false);
    expect(queue.running()).not.toContain('a');
    expect(queue.running()).not.toContain('b');

    queue.enter({ instanceId: 'c', focus: false, documentOrder: 3 });
    watch('c');
    expect(playing.has('c')).toBe(false);
    expect(queue.finish('a')).toEqual([]);
    expect(playing.has('c')).toBe(false);

    watch('focus');
    expect(playing.has('a')).toBe(false);
    expect(playing.has('b')).toBe(false);
    expect(playing.has('focus')).toBe(true);

    expect(queue.finish('focus')).toEqual(['c']);
    expect(playing.has('a')).toBe(false);
    expect(playing.has('b')).toBe(false);
    expect(playing.has('c')).toBe(true);
    expect(queue.running()).toEqual(['c']);
  });

  it('starts the schedule when iframes are ready and releases unmarked plays after focus finishes', () => {
    const { queue, started, listeners } = readyQueue([
      { instanceId: 'home', focus: false, documentOrder: 0 },
      { instanceId: 'restaurant', focus: true, documentOrder: 1 },
      { instanceId: 'cart', focus: false, documentOrder: 2 },
    ]);

    expect(started).toEqual([]);
    expect(queue.released()).toEqual([]);

    listeners.get('home')?.({ kind: 'play', instanceId: 'home', phase: 'ready' });
    listeners.get('cart')?.({ kind: 'play', instanceId: 'cart', phase: 'ready' });
    expect(started).toEqual([]);
    expect(queue.isReleased('restaurant')).toBe(false);

    listeners.get('restaurant')?.({ kind: 'play', instanceId: 'restaurant', phase: 'ready' });
    expect(started).toEqual(['restaurant']);
    expect(queue.released()).toEqual(['restaurant']);

    listeners.get('restaurant')?.({ kind: 'play', instanceId: 'restaurant', phase: 'done' });
    expect(started).toEqual(['restaurant', 'home', 'cart']);
    expect(queue.released()).toEqual(['restaurant', 'home', 'cart']);
  });
});
