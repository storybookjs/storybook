import { describe, expect, it } from 'vitest';

import { AGENTS, PROJECTS } from './types';

describe('AGENTS', () => {
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

describe('PROJECTS', () => {
  it('has at least one project', () => {
    expect(PROJECTS.length).toBeGreaterThan(0);
  });

  it('each project has name, repo URL, and branch', () => {
    for (const project of PROJECTS) {
      expect(project.name).toBeTruthy();
      expect(project.repo).toMatch(/^https:\/\/github\.com\//);
      expect(project.branch).toBeTruthy();
    }
  });

  it('project names are unique', () => {
    const names = PROJECTS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
