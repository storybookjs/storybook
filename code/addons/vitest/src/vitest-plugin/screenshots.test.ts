import { describe, expect, it } from 'vitest';

import { buildStoryScreenshotPath, shouldCaptureStoryScreenshot } from './screenshots';

describe('buildStoryScreenshotPath', () => {
  it('writes screenshots next to the story file', () => {
    expect(buildStoryScreenshotPath('/repo/src/Button.stories.tsx', 'Primary')).toBe(
      '/repo/src/Button.stories.Primary.chromium.png'
    );
  });

  it('sanitizes export names for the filesystem', () => {
    expect(buildStoryScreenshotPath('/repo/src/Button.stories.tsx', 'Primary Story')).toBe(
      '/repo/src/Button.stories.Primary-Story.chromium.png'
    );
  });
});

describe('shouldCaptureStoryScreenshot', () => {
  it('captures base story tests for story files', () => {
    expect(
      shouldCaptureStoryScreenshot({
        storyFilePath: '/repo/src/Button.stories.tsx',
      })
    ).toBe(true);
  });

  it('skips nested story test cases', () => {
    expect(
      shouldCaptureStoryScreenshot({
        storyFilePath: '/repo/src/Button.stories.tsx',
        testName: 'hover state',
      })
    ).toBe(false);
  });

  it('skips non-story files', () => {
    expect(
      shouldCaptureStoryScreenshot({
        storyFilePath: '/repo/src/Button.tsx',
      })
    ).toBe(false);
  });
});
