import { describe, expect, it } from 'vitest';

import { getCacheRefreshReason, type TrialCacheInfo } from './prepare-trial.ts';
import type { Project } from './projects.ts';

const project: Project = {
  name: 'mealdrop',
  repo: 'https://github.com/example/mealdrop',
  branch: 'eval-baseline',
};

const cacheInfo: TrialCacheInfo = {
  repo: project.repo,
  branch: project.branch,
  baselineCommit: '0123456789abcdef',
};

describe('getCacheRefreshReason', () => {
  it('keeps the cache when repo, branch, and baseline still match', () => {
    expect(getCacheRefreshReason(project, cacheInfo, cacheInfo.baselineCommit)).toBeUndefined();
  });

  it('refreshes when the repo URL changes', () => {
    expect(
      getCacheRefreshReason(
        { ...project, repo: 'https://github.com/example/mealdrop-fork' },
        cacheInfo,
        cacheInfo.baselineCommit
      )
    ).toContain('repo changed');
  });

  it('refreshes when the tracked branch changes', () => {
    expect(
      getCacheRefreshReason({ ...project, branch: 'next' }, cacheInfo, cacheInfo.baselineCommit)
    ).toContain('branch changed');
  });

  it('refreshes when the remote branch head advances', () => {
    expect(getCacheRefreshReason(project, cacheInfo, 'fedcba9876543210')).toContain(
      'baseline branch advanced'
    );
  });

  it('keeps the cache if the remote branch cannot be verified', () => {
    expect(getCacheRefreshReason(project, cacheInfo)).toBeUndefined();
  });
});
