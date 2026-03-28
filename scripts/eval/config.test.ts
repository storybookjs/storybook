import { describe, expect, it } from 'vitest';

import { PROJECTS, agents } from './config';

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

describe('agents', () => {
  it('each agent has a name and execute method', () => {
    for (const agent of Object.values(agents)) {
      expect(agent.name).toBeTruthy();
      expect(typeof agent.execute).toBe('function');
    }
  });
});
