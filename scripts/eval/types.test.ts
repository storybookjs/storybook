import { describe, expect, it } from 'vitest';

import { AGENTS, PROJECTS } from './config';

/**
 * Basic shape validation (required fields, defaults, types) is handled by Zod
 * schemas at import time — AgentConfig.parse() in config.ts throws on invalid
 * config. These tests cover cross-cutting invariants that Zod cannot express.
 */

describe('AGENTS', () => {
  it('validates against schema (the import itself proves this)', () => {
    // AgentConfig.parse() runs at import time. If this test file loads,
    // the config is valid (models non-empty, defaultModel in list, etc.).
    expect(Object.keys(AGENTS)).toEqual(['claude', 'codex']);
  });

  it('no model is shared between agents', () => {
    const allModels = Object.values(AGENTS).flatMap((a) => a.models);
    expect(new Set(allModels).size).toBe(allModels.length);
  });

  it('sdkModelIds only reference known models', () => {
    for (const [, cfg] of Object.entries(AGENTS)) {
      for (const model of Object.keys(cfg.sdkModelIds)) {
        expect(cfg.models).toContain(model);
      }
    }
  });

  it('pricing only references known models', () => {
    for (const [, cfg] of Object.entries(AGENTS)) {
      for (const model of Object.keys(cfg.pricing)) {
        expect(cfg.models).toContain(model);
      }
    }
  });
});

describe('PROJECTS', () => {
  it('has at least one project', () => {
    expect(PROJECTS.length).toBeGreaterThan(0);
  });

  it('project names are unique', () => {
    const names = PROJECTS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
