import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import {
  getChangedStoryFiles,
  getGeneratedStoryFiles,
  getPreviewEnvironmentFiles,
} from './story-render.ts';
import type { FileChange } from './grade.ts';

describe('getChangedStoryFiles', () => {
  it('returns created and modified story files only', () => {
    const fileChanges: FileChange[] = [
      { path: 'src/Button.stories.tsx', gitStatus: 'A' },
      { path: 'src/Header.story.ts', gitStatus: 'M' },
      { path: '.storybook/main.ts', gitStatus: 'M' },
      { path: 'src/Deleted.stories.tsx', gitStatus: 'D' },
    ];

    expect(getChangedStoryFiles('/repo', fileChanges)).toEqual([
      join('/repo', 'src', 'Button.stories.tsx'),
      join('/repo', 'src', 'Header.story.ts'),
    ]);
  });
});

describe('getGeneratedStoryFiles', () => {
  it('returns generated story files that live under the evaluated project path', () => {
    const fileChanges: FileChange[] = [
      { path: 'frontend/src/App.stories.tsx', gitStatus: 'A' },
      { path: 'frontend/src/components/Button.stories.tsx', gitStatus: 'M' },
      { path: 'frontend/.storybook/preview.tsx', gitStatus: 'M' },
      { path: 'docs/Button.stories.tsx', gitStatus: 'A' },
    ];

    expect(getGeneratedStoryFiles('/repo', '/repo/frontend', fileChanges).sort()).toEqual(
      [
        join('/repo', 'frontend', 'src', 'App.stories.tsx'),
        join('/repo', 'frontend', 'src', 'components', 'Button.stories.tsx'),
      ].sort()
    );
  });
});

describe('getPreviewEnvironmentFiles', () => {
  it('returns only preview files for baseline rollback', () => {
    const fileChanges: FileChange[] = [
      { path: 'frontend/.storybook/main.ts', gitStatus: 'M' },
      { path: 'frontend/.storybook/preview.tsx', gitStatus: 'M' },
      { path: 'frontend/.storybook/preview-body.html', gitStatus: 'A' },
      { path: 'frontend/.storybook/wiki-mocks.ts', gitStatus: 'A' },
      { path: 'frontend/.storybook/eval-support/summary.mdx', gitStatus: 'M' },
      { path: 'frontend/.storybook/eval-results/data.json', gitStatus: 'M' },
    ];

    expect(getPreviewEnvironmentFiles(fileChanges)).toEqual(['frontend/.storybook/preview.tsx']);
  });

  it('considers renamed preview files via previousPath', () => {
    const fileChanges: FileChange[] = [
      {
        path: 'frontend/.storybook/preview.ts',
        previousPath: 'frontend/.storybook/preview.tsx',
        gitStatus: 'R',
      },
    ];

    expect(getPreviewEnvironmentFiles(fileChanges)).toEqual([
      'frontend/.storybook/preview.ts',
      'frontend/.storybook/preview.tsx',
    ]);
  });
});
