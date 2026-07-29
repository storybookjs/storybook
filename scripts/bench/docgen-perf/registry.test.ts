import { describe, expect, it } from 'vitest';

import { QUICK_PROFILE } from './config.ts';
import { ALL_ENGINE_IDS, ENGINES, engineById } from './registry.ts';
import type { EngineId } from './types.ts';

describe('the engine table', () => {
  it('registers each id exactly once', () => {
    expect(new Set(ALL_ENGINE_IDS).size).toBe(ALL_ENGINE_IDS.length);
  });

  it('names an engine that is not registered', () => {
    expect(() => engineById('svelte' as EngineId)).toThrow('no engine registered for "svelte"');
  });

  it('gives every engine at least one scenario, with unique names', () => {
    for (const engine of ENGINES) {
      const names = engine.scenarios(QUICK_PROFILE).map((s) => s.name);
      expect(names.length, engine.id).toBeGreaterThan(0);
      expect(new Set(names).size, engine.id).toBe(names.length);
    }
  });
});
