import type { PlayPhase } from './channel-router.ts';

export type PlayPanelPhase = 'idle' | 'queued' | 'playing' | 'played' | 'error';

export type PlayPanelState = {
  phase: PlayPanelPhase;
  hasPlayFunction: boolean;
};

export type PlayPanelRegistry = Record<string, PlayPanelState>;

const UNREPORTED_STATE: PlayPanelState = { phase: 'idle', hasPlayFunction: true };

export function createPlayPanelRegistry(): PlayPanelRegistry {
  return {};
}

/**
 * Read one instance's panel state. An instance that has not reported yet reads as idle.
 */
export function playPanelState(registry: PlayPanelRegistry, instanceId: string): PlayPanelState {
  return registry[instanceId] ?? UNREPORTED_STATE;
}

/**
 * Record one instance's latest reported play phase. Instances never share state.
 */
export function withPlayPanelPhase(
  registry: PlayPanelRegistry,
  instanceId: string,
  play: PlayPhase | null
): PlayPanelRegistry {
  return { ...registry, [instanceId]: toPlayPanelState(play) };
}

/**
 * Drop one instance so a later id reuse starts from idle instead of its old phase.
 */
export function withoutPlayPanelInstance(
  registry: PlayPanelRegistry,
  instanceId: string
): PlayPanelRegistry {
  const { [instanceId]: _removed, ...rest } = registry;
  return rest;
}

function toPlayPanelState(play: PlayPhase | null): PlayPanelState {
  if (play === null) {
    return UNREPORTED_STATE;
  }
  if (play === 'absent') {
    return { phase: 'idle', hasPlayFunction: false };
  }
  if (play === 'ready' || play === 'pause') {
    return { phase: 'queued', hasPlayFunction: true };
  }
  if (play === 'start' || play === 'resume') {
    return { phase: 'playing', hasPlayFunction: true };
  }
  if (play === 'done') {
    return { phase: 'played', hasPlayFunction: true };
  }
  return { phase: 'error', hasPlayFunction: true };
}
