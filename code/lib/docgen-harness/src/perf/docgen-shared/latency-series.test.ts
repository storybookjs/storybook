import { afterEach, describe, expect, it, vi } from 'vitest';

import { runLatencySeries } from './latency-series.ts';
import { runSeries, type SeriesEngine } from './series.ts';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the separated save-series lanes', () => {
  it('preserves ordered latency observations and never invokes forced GC', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const gc = vi.fn();
    vi.stubGlobal('gc', gc);
    const calls: string[] = [];
    const engine: SeriesEngine = {
      cold() {
        calls.push('cold');
        return 30;
      },
      applySave(save) {
        calls.push(`apply-${save}`);
      },
      reextract(save) {
        calls.push(`extract-${save}`);
        return 10 + save;
      },
      dispose() {
        calls.push('dispose');
      },
    };

    const result = await runLatencySeries(engine, { saves: 3, coldLabel: 'fixture' });

    expect(calls).toEqual([
      'cold',
      'apply-1',
      'extract-1',
      'apply-2',
      'extract-2',
      'apply-3',
      'extract-3',
      'dispose',
    ]);
    expect(result.cold.members).toBe(30);
    expect(result.warm.map(({ save, members }) => ({ save, members }))).toEqual([
      { save: 1, members: 11 },
      { save: 2, members: 12 },
      { save: 3, members: 13 },
    ]);
    expect(gc).not.toHaveBeenCalled();
  });

  it('retains the documented work for every memory save', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await runSeries(
      {
        cold: () => 20,
        applySave: () => {},
        reextract: (save) => save * 2,
      },
      { saves: 3, coldLabel: 'fixture', forceGc: false }
    );

    expect(
      result.samples.map(({ save, documentedMembers }) => ({ save, documentedMembers }))
    ).toEqual([
      { save: 1, documentedMembers: 2 },
      { save: 2, documentedMembers: 4 },
      { save: 3, documentedMembers: 6 },
    ]);
    expect(result.warmMembers).toBe(6);
  });

  it('rejects an empty trajectory and disposes after a measurement failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const dispose = vi.fn();
    const engine: SeriesEngine = {
      cold: () => 1,
      applySave: () => {},
      reextract: () => {
        throw new Error('extract failed');
      },
      dispose,
    };

    await expect(runLatencySeries(engine, { saves: 1, coldLabel: 'fixture' })).rejects.toThrow(
      'extract failed'
    );
    expect(dispose).toHaveBeenCalledOnce();
    await expect(runLatencySeries(engine, { saves: 0, coldLabel: 'fixture' })).rejects.toThrow(
      'positive safe integer'
    );
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});
