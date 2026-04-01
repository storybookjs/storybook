import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { collectScreenshotArtifacts, getChangedStoryFiles } from './screenshots';
import type { FileChange } from './grade';

let TMP = '';

afterEach(() => {
  if (TMP) {
    rmSync(TMP, { recursive: true, force: true });
    TMP = '';
  }
});

describe('getChangedStoryFiles', () => {
  it('returns created and modified story files only', () => {
    const repoRoot = '/repo';
    const fileChanges: FileChange[] = [
      { path: 'src/Button.stories.tsx', gitStatus: 'A' },
      { path: 'src/Header.story.ts', gitStatus: 'M' },
      { path: '.storybook/main.ts', gitStatus: 'M' },
      { path: 'src/Deleted.stories.tsx', gitStatus: 'D' },
    ];

    expect(getChangedStoryFiles(repoRoot, fileChanges)).toEqual([
      '/repo/src/Button.stories.tsx',
      '/repo/src/Header.story.ts',
    ]);
  });
});

describe('collectScreenshotArtifacts', () => {
  it('collects colocated screenshot files for a story file', async () => {
    TMP = join(tmpdir(), `eval-screenshots-${Date.now()}`);
    mkdirSync(join(TMP, 'src'), { recursive: true });
    writeFileSync(join(TMP, 'src', 'Button.stories.tsx'), 'export const Primary = {};');
    writeFileSync(join(TMP, 'src', 'Button.stories.Primary.chromium.png'), 'png');
    writeFileSync(join(TMP, 'src', 'Button.stories.Secondary.chromium.png'), 'png');

    const screenshots = await collectScreenshotArtifacts(TMP, [
      join(TMP, 'src', 'Button.stories.tsx'),
    ]);

    expect(screenshots).toEqual([
      {
        storyFilePath: 'src/Button.stories.tsx',
        exportName: 'Primary',
        imagePath: 'src/Button.stories.Primary.chromium.png',
      },
      {
        storyFilePath: 'src/Button.stories.tsx',
        exportName: 'Secondary',
        imagePath: 'src/Button.stories.Secondary.chromium.png',
      },
    ]);
  });
});
