import { describe, expect, it } from 'vitest';

import { completePlay, createPlayScheduler, enqueuePlays } from './play-scheduler.ts';

describe('play scheduler', () => {
  it('runs unmarked plays concurrently', () => {
    const queued = enqueuePlays(createPlayScheduler(), [
      { instanceId: 'a', focus: false, documentOrder: 0 },
      { instanceId: 'b', focus: false, documentOrder: 1 },
      { instanceId: 'c', focus: false, documentOrder: 2 },
    ]);

    expect(queued.effects).toEqual([
      { type: 'start', instanceId: 'a' },
      { type: 'start', instanceId: 'b' },
      { type: 'start', instanceId: 'c' },
    ]);
  });

  it('runs focus plays one at a time in document order', () => {
    const queued = enqueuePlays(createPlayScheduler(), [
      { instanceId: 'later', focus: true, documentOrder: 5 },
      { instanceId: 'earlier', focus: true, documentOrder: 1 },
    ]);

    expect(queued.effects).toEqual([{ type: 'start', instanceId: 'earlier' }]);
    expect(queued.state.plays.find((play) => play.instanceId === 'later')?.status).toBe('queued');

    const next = completePlay(queued.state, 'earlier');
    expect(next.effects).toEqual([{ type: 'start', instanceId: 'later' }]);
  });

  it('pauses every running play while a focus play is running', () => {
    const concurrent = enqueuePlays(createPlayScheduler(), [
      { instanceId: 'a', focus: false, documentOrder: 0 },
      { instanceId: 'b', focus: false, documentOrder: 1 },
    ]);
    const exclusive = enqueuePlays(concurrent.state, [
      { instanceId: 'focus', focus: true, documentOrder: 2 },
    ]);

    expect(exclusive.effects).toEqual([
      { type: 'pause', instanceId: 'a' },
      { type: 'pause', instanceId: 'b' },
      { type: 'start', instanceId: 'focus' },
    ]);

    const waiting = enqueuePlays(exclusive.state, [
      { instanceId: 'c', focus: false, documentOrder: 3 },
    ]);
    expect(waiting.effects).toEqual([]);
    expect(waiting.state.plays.find((play) => play.instanceId === 'c')?.status).toBe('queued');

    const resumed = completePlay(waiting.state, 'focus');
    expect(resumed.effects).toEqual([
      { type: 'resume', instanceId: 'a' },
      { type: 'resume', instanceId: 'b' },
      { type: 'start', instanceId: 'c' },
    ]);
  });

  it('holds unmarked plays until focus plays queued with them have finished', () => {
    const queued = enqueuePlays(createPlayScheduler(), [
      { instanceId: 'plain', focus: false, documentOrder: 0 },
      { instanceId: 'focus', focus: true, documentOrder: 1 },
    ]);

    expect(queued.effects).toEqual([{ type: 'start', instanceId: 'focus' }]);
    expect(completePlay(queued.state, 'focus').effects).toEqual([
      { type: 'start', instanceId: 'plain' },
    ]);
  });
});
