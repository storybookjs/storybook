import { describe, expect, it } from 'vitest';

import type { Project } from './projects';

const project: Project = {
  name: 'mealdrop',
  repo: 'https://github.com/example/mealdrop',
  branch: 'main',
  githubSlug: 'storybook-tmp/mealdrop',
};

describe('project trial branch conventions', () => {
  it('tracks benchmark baselines from main on storybook-tmp', () => {
    expect(project.branch).toBe('main');
    expect(project.githubSlug).toBe('storybook-tmp/mealdrop');
  });
});
