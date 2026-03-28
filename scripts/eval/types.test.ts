import { describe, expect, it } from 'vitest';

import { AGENTS } from './types';

describe('AGENTS config', () => {
  it('has claude and codex agents', () => {
    expect(AGENTS).toHaveProperty('claude');
    expect(AGENTS).toHaveProperty('codex');
  });

  it('each agent has a non-empty models list', () => {
    for (const config of Object.values(AGENTS)) {
      expect(config.models.length).toBeGreaterThan(0);
    }
  });

  it('each agent defaultModel is in its models list', () => {
    for (const config of Object.values(AGENTS)) {
      expect(config.models).toContain(config.defaultModel);
    }
  });

  it('no model is shared between agents', () => {
    const allModels = Object.values(AGENTS).flatMap((a) => a.models);
    expect(new Set(allModels).size).toBe(allModels.length);
  });
});
