import { ManagerDocsError } from '../errors.ts';
import type { InstanceEvent } from './channel-router.ts';
import {
  completePlay,
  createPlayScheduler,
  dropPlay,
  enqueuePlays,
  type PlayEffect,
  type ScheduledPlay,
  type SchedulerState,
} from './play-scheduler.ts';

export type IframePlayQueue = {
  bind: (instanceId: string, run: () => void, stop?: () => void) => boolean;
  absent: (instanceId: string) => string[];
  enter: (play: ScheduledPlay) => string[];
  leave: (instanceId: string) => string[];
  finish: (instanceId: string) => string[];
  isReleased: (instanceId: string) => boolean;
  released: () => string[];
  running: () => string[];
};

export function connectDocsPlays(
  queue: IframePlayQueue,
  instances: readonly { instanceId: string }[],
  transport: {
    listen: (instanceId: string, listener: (event: InstanceEvent) => void) => (() => void) | void;
    startPlay: (instanceId: string) => void;
    pausePlay: (instanceId: string) => void;
  }
): () => void {
  const stops: ((() => void) | void)[] = [];
  for (const instance of instances) {
    const stop = transport.listen(instance.instanceId, (event) => {
      if (event.kind !== 'play') {
        return;
      }
      if (event.phase === 'ready') {
        queue.bind(
          instance.instanceId,
          () => {
            startIframePlay(queue, instance.instanceId, () => {
              transport.startPlay(instance.instanceId);
            });
          },
          () => {
            transport.pausePlay(instance.instanceId);
          }
        );
      }
      if (event.phase === 'absent') {
        queue.absent(instance.instanceId);
      }
      if (
        (event.phase === 'done' || event.phase === 'error') &&
        queue.isReleased(instance.instanceId)
      ) {
        queue.finish(instance.instanceId);
      }
    });
    stops.push(stop);
  }
  return () => {
    for (const stop of stops) {
      stop?.();
    }
  };
}

export function startIframePlay(
  queue: { isReleased: (instanceId: string) => boolean },
  instanceId: string,
  run: () => void
): void {
  if (!queue.isReleased(instanceId)) {
    throw new ManagerDocsError(
      `Refusing to start play "${instanceId}" before the scheduler releases it.`
    );
  }
  run();
}

export function createIframePlayQueue(plays: ScheduledPlay[]): IframePlayQueue {
  const ordered = [...plays].sort(
    (left, right) =>
      left.documentOrder - right.documentOrder || left.instanceId.localeCompare(right.instanceId)
  );
  const queued = enqueuePlays(createPlayScheduler(), ordered);
  let state: SchedulerState = queued.state;
  const pending = new Set<string>();
  const ports = new Map<string, () => void>();
  const stops = new Map<string, () => void>();
  const released = new Set<string>();
  const running = new Set<string>();
  const finished = new Set<string>();
  const endedWhilePaused = new Set<string>();
  const gate = { isReleased: (instanceId: string) => released.has(instanceId) };
  note(queued.effects);

  function note(effects: PlayEffect[]): unknown[] {
    const errors: unknown[] = [];
    const stopping: string[] = [];
    const followups: PlayEffect[] = [];
    for (const effect of effects) {
      if (effect.type === 'start') {
        pending.add(effect.instanceId);
        continue;
      }
      if (effect.type === 'pause') {
        pending.delete(effect.instanceId);
        if (running.delete(effect.instanceId)) {
          stopping.push(effect.instanceId);
        }
        continue;
      }
      if (endedWhilePaused.delete(effect.instanceId)) {
        running.delete(effect.instanceId);
        finished.add(effect.instanceId);
        const next = completePlay(state, effect.instanceId);
        state = next.state;
        followups.push(...next.effects);
        continue;
      }
      // Resume does not start a play that already entered its iframe.
      if (!released.has(effect.instanceId) && !finished.has(effect.instanceId)) {
        pending.add(effect.instanceId);
      }
    }
    for (const instanceId of stopping) {
      const stop = stops.get(instanceId);
      if (!stop) {
        continue;
      }
      try {
        stop();
      } catch (error) {
        errors.push(error);
      }
    }
    if (followups.length > 0) {
      errors.push(...note(followups));
    }
    return errors;
  }

  function commit(effects: PlayEffect[]): string[] {
    const errors = note(effects);
    const started = flush();
    if (errors.length > 0) {
      throw errors[0];
    }
    return started;
  }

  function flush(): string[] {
    const started: string[] = [];
    const errors: unknown[] = [];
    for (const instanceId of [...pending]) {
      const run = ports.get(instanceId);
      if (!run || released.has(instanceId)) {
        continue;
      }
      pending.delete(instanceId);
      released.add(instanceId);
      running.add(instanceId);
      try {
        run();
      } catch (error) {
        errors.push(error);
      }
      started.push(instanceId);
    }
    if (errors.length > 0) {
      throw errors[0];
    }
    return started;
  }

  return {
    bind(instanceId, run, stop) {
      if (ports.has(instanceId)) {
        return released.has(instanceId);
      }
      if (!state.plays.some((play) => play.instanceId === instanceId)) {
        throw new ManagerDocsError(`No scheduled play for "${instanceId}".`);
      }
      ports.set(instanceId, () => startIframePlay(gate, instanceId, run));
      if (stop) {
        stops.set(instanceId, stop);
      }
      flush();
      return released.has(instanceId);
    },
    absent(instanceId) {
      if (released.has(instanceId) || finished.has(instanceId)) {
        return [];
      }
      pending.delete(instanceId);
      running.delete(instanceId);
      endedWhilePaused.delete(instanceId);
      finished.add(instanceId);
      const next = dropPlay(state, instanceId);
      state = next.state;
      return commit(next.effects);
    },
    enter(play) {
      const next = enqueuePlays(state, [play]);
      state = next.state;
      return commit(next.effects);
    },
    leave(instanceId) {
      const next = dropPlay(state, instanceId);
      state = {
        plays: next.state.plays.filter((play) => play.instanceId !== instanceId),
      };
      for (const tracked of [pending, released, running, finished, endedWhilePaused]) {
        tracked.delete(instanceId);
      }
      ports.delete(instanceId);
      stops.delete(instanceId);
      return commit(next.effects);
    },
    finish(instanceId) {
      if (!released.has(instanceId) || finished.has(instanceId)) {
        throw new ManagerDocsError(`Cannot finish play "${instanceId}" because it is not running.`);
      }
      const play = state.plays.find((item) => item.instanceId === instanceId);
      if (play?.status === 'paused') {
        endedWhilePaused.add(instanceId);
        running.delete(instanceId);
        return [];
      }
      finished.add(instanceId);
      running.delete(instanceId);
      const next = completePlay(state, instanceId);
      state = next.state;
      return commit(next.effects);
    },
    isReleased: (instanceId) => released.has(instanceId),
    released: () => [...released],
    running: () => [...running],
  };
}
