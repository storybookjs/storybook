import { ManagerDocsError } from '../errors.ts';

export type ScheduledPlay = {
  instanceId: string;
  focus: boolean;
  documentOrder: number;
};

export type PlayStatus = 'queued' | 'running' | 'paused' | 'done';

export type PlayRecord = ScheduledPlay & {
  status: PlayStatus;
};

export type SchedulerState = {
  plays: PlayRecord[];
};

export type PlayEffect =
  | { type: 'start'; instanceId: string }
  | { type: 'pause'; instanceId: string }
  | { type: 'resume'; instanceId: string };

/**
 * Create a scheduler with nothing running.
 */
export function createPlayScheduler(): SchedulerState {
  return { plays: [] };
}

/**
 * Queue plays and start whatever the focus contract allows.
 *
 * Unmarked plays run together. A focus play runs alone, in document order, and pauses every other running play.
 */
export function enqueuePlays(
  state: SchedulerState,
  plays: ScheduledPlay[]
): { state: SchedulerState; effects: PlayEffect[] } {
  const next = plays.reduce((current, play) => {
    if (current.some((existing) => existing.instanceId === play.instanceId)) {
      return current;
    }
    return [...current, { ...play, status: 'queued' as const }];
  }, state.plays);
  return settle({ plays: next });
}

// A story with no play function must leave the queue or it holds every later play.
export function dropPlay(
  state: SchedulerState,
  instanceId: string
): { state: SchedulerState; effects: PlayEffect[] } {
  const play = state.plays.find((item) => item.instanceId === instanceId);
  if (!play || play.status === 'done') {
    return { state, effects: [] };
  }
  if (play.status === 'running') {
    return completePlay(state, instanceId);
  }
  return settle({
    plays: state.plays.map((item) =>
      item.instanceId === instanceId ? { ...item, status: 'done' } : item
    ),
  });
}

/**
 * Mark a running play done, then start the next play the contract allows.
 */
export function completePlay(
  state: SchedulerState,
  instanceId: string
): { state: SchedulerState; effects: PlayEffect[] } {
  const play = state.plays.find((item) => item.instanceId === instanceId);
  if (!play || play.status !== 'running') {
    throw new ManagerDocsError(`Cannot complete play "${instanceId}" because it is not running.`);
  }
  return settle({
    plays: state.plays.map((item) =>
      item.instanceId === instanceId ? { ...item, status: 'done' } : item
    ),
  });
}

function settle(state: SchedulerState): { state: SchedulerState; effects: PlayEffect[] } {
  const effects: PlayEffect[] = [];
  const plays = state.plays.map((play) => ({ ...play }));
  const runningFocus = plays.filter((play) => play.status === 'running' && play.focus);
  if (runningFocus.length > 0) {
    return { state: { plays }, effects };
  }

  const queuedFocus = plays
    .filter((play) => play.focus && play.status === 'queued')
    .sort(
      (left, right) =>
        left.documentOrder - right.documentOrder || left.instanceId.localeCompare(right.instanceId)
    );

  if (queuedFocus.length > 0) {
    for (const play of plays) {
      if (play.status === 'running') {
        play.status = 'paused';
        effects.push({ type: 'pause', instanceId: play.instanceId });
      }
    }
    queuedFocus[0].status = 'running';
    effects.push({ type: 'start', instanceId: queuedFocus[0].instanceId });
    return { state: { plays }, effects };
  }

  for (const play of plays) {
    if (play.focus || (play.status !== 'queued' && play.status !== 'paused')) {
      continue;
    }
    const resume = play.status === 'paused';
    play.status = 'running';
    effects.push({ type: resume ? 'resume' : 'start', instanceId: play.instanceId });
  }
  return { state: { plays }, effects };
}
