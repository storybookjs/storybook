import { describe, expect, it } from 'vitest';

import { buildTrialArtifactUrls, buildTrialLabels } from './publish-trial';
import type { Project } from './projects';
import type { AgentVariant } from './agents/config';

const project: Project = {
  name: 'mealdrop',
  repo: 'https://github.com/storybook-tmp/mealdrop',
  branch: 'main',
  githubSlug: 'storybook-tmp/mealdrop',
};

const variant: AgentVariant = {
  agent: 'claude',
  model: 'sonnet-4.6',
  effort: 'high',
};

describe('buildTrialLabels', () => {
  it('includes eval, project, agent, model, effort, and prompt labels', () => {
    expect(buildTrialLabels(project, variant, 'setup')).toEqual([
      'eval',
      'project:mealdrop',
      'agent:claude',
      'model:sonnet-4.6',
      'effort:high',
      'prompt:setup',
    ]);
  });
});

describe('buildTrialArtifactUrls', () => {
  it('creates blob URLs for committed eval artifacts on the trial branch', () => {
    expect(buildTrialArtifactUrls(project, 'trial/foo')).toEqual({
      summaryUrl:
        'https://github.com/storybook-tmp/mealdrop/blob/trial/foo/eval-results/summary.json',
      transcriptUrl:
        'https://github.com/storybook-tmp/mealdrop/blob/trial/foo/eval-results/transcript.json',
    });
  });
});
