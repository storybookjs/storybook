import { join, parse } from 'pathe';

const SCREENSHOT_ENV_FLAG = '__STORYBOOK_SCREENSHOTS__';
const STORY_FILE_PATTERN = /\.(stories|story)\.[tj]sx?$/;

export const isAutomaticScreenshotCaptureEnabled = () =>
  import.meta.env[SCREENSHOT_ENV_FLAG] === 'true';

export const buildStoryScreenshotPath = (storyFilePath: string, exportName: string) => {
  const { dir, name } = parse(storyFilePath);
  return join(dir, `${name}.${sanitizePathToken(exportName)}.chromium.png`);
};

export const shouldCaptureStoryScreenshot = (opts: {
  storyFilePath?: string;
  testName?: string;
}) => Boolean(opts.storyFilePath && STORY_FILE_PATTERN.test(opts.storyFilePath) && !opts.testName);

export async function captureStoryScreenshot(opts: {
  exportName: string;
  storyFilePath?: string;
  testName?: string;
}) {
  if (!isAutomaticScreenshotCaptureEnabled() || !shouldCaptureStoryScreenshot(opts)) {
    return undefined;
  }

  const { page } = await import('@vitest/browser/context').catch(() => ({
    page: undefined,
  }));
  if (!page) {
    return undefined;
  }

  return page.screenshot({ path: buildStoryScreenshotPath(opts.storyFilePath!, opts.exportName) });
}

function sanitizePathToken(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}
