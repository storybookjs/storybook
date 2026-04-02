import { describe, expect, it } from 'vitest';

import { PROJECTS } from './projects.ts';

const githubRepoUrl = /^https:\/\/github\.com\/[^/]+\/[^/]+$/;

describe('PROJECTS', () => {
  it('pins every benchmark project to a pre-initialized eval-baseline repo', () => {
    expect(PROJECTS.length).toBeGreaterThan(0);

    for (const project of PROJECTS) {
      expect(project).toMatchObject({
        branch: 'eval-baseline',
        repo: expect.stringMatching(githubRepoUrl),
        description: expect.any(String),
      });
    }
  });

  it('keeps benchmark project metadata unambiguous', () => {
    const names = PROJECTS.map((p) => p.name);
    const repos = PROJECTS.map((p) => p.repo);

    expect(new Set(names).size).toBe(names.length);
    expect(new Set(repos).size).toBe(repos.length);

    for (const project of PROJECTS) {
      if (!project.projectDir) continue;
      expect(project.projectDir).toMatch(/^(?!\/)(?!\.\.?(?:\/|$)).+/);
    }
  });
});
