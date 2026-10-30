import { describe, expect, it } from 'vitest';

import {
  createPlayPanelRegistry,
  playPanelState,
  withoutPlayPanelInstance,
  withPlayPanelPhase,
} from './play-panel.ts';

describe('play panel registry', () => {
  it('reports an unseen instance as idle with no play function known yet', () => {
    expect(playPanelState(createPlayPanelRegistry(), 'button--primary#1')).toEqual({
      phase: 'idle',
      hasPlayFunction: true,
    });
  });

  it('keeps two instances of the same story independent', () => {
    const empty = createPlayPanelRegistry();
    const first = withPlayPanelPhase(empty, 'button--primary#1', 'start');
    const both = withPlayPanelPhase(first, 'button--primary#2', 'absent');

    expect(playPanelState(both, 'button--primary#1')).toEqual({
      phase: 'playing',
      hasPlayFunction: true,
    });
    expect(playPanelState(both, 'button--primary#2')).toEqual({
      phase: 'idle',
      hasPlayFunction: false,
    });

    const finished = withPlayPanelPhase(both, 'button--primary#1', 'done');
    expect(playPanelState(finished, 'button--primary#1').phase).toBe('played');
    expect(playPanelState(finished, 'button--primary#2')).toEqual({
      phase: 'idle',
      hasPlayFunction: false,
    });
  });

  it.each([
    ['ready', 'queued'],
    ['pause', 'queued'],
    ['start', 'playing'],
    ['resume', 'playing'],
    ['done', 'played'],
    ['error', 'error'],
  ] as const)('maps the "%s" channel phase to the "%s" panel phase', (play, phase) => {
    const registry = withPlayPanelPhase(createPlayPanelRegistry(), 'a', play);

    expect(playPanelState(registry, 'a')).toEqual({ phase, hasPlayFunction: true });
  });

  it('drops an instance so a reused id starts fresh instead of inheriting its old phase', () => {
    const played = withPlayPanelPhase(createPlayPanelRegistry(), 'a', 'done');

    expect(playPanelState(withoutPlayPanelInstance(played, 'a'), 'a')).toEqual({
      phase: 'idle',
      hasPlayFunction: true,
    });
  });
});
