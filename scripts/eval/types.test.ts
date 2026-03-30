import { describe, expect, it } from 'vitest';

import { AGENTS, PROJECTS } from './config';

const githubRepoUrl = /^https:\/\/github\.com\/[^/]+\/[^/]+$/;

describe('AGENTS', () => {
  it('keeps each agent default inside its supported model and effort lists', () => {
    for (const config of Object.values(AGENTS)) {
      expect(config).toMatchObject({
        defaultModel: expect.any(String),
        defaultEffort: expect.any(String),
      });
      expect(config.models).toContain(config.defaultModel);
      expect(config.efforts).toContain(config.defaultEffort);
    }
  });

  it('keeps Claude models fully remappable to SDK model ids', () => {
    expect(AGENTS.claude).toMatchObject({
      defaultModel: 'sonnet-4.6',
      defaultEffort: 'high',
      sdkModelIds: Object.fromEntries(
        AGENTS.claude.models.map((model) => [model, expect.any(String)])
      ),
    });
  });

  it('keeps Codex models fully priceable from token usage', () => {
    expect(AGENTS.codex).toMatchObject({
      defaultModel: 'gpt-5.4',
      defaultEffort: 'high',
      pricing: Object.fromEntries(
        AGENTS.codex.models.map((model) => [
          model,
          {
            input: expect.any(Number),
            cachedInput: expect.any(Number),
            output: expect.any(Number),
          },
        ])
      ),
    });
  });
});

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
