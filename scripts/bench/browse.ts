import { chromium } from 'playwright';

import { getPreviewPage, now } from './utils';

interface Result {
  managerHeaderVisible?: number;
  managerIndexVisible?: number;
  storyVisible?: number;
  storyVisibleUncached?: number;
  autodocsVisible?: number;
  mdxVisible?: number;
}

export const browse = async (url: string, { disableDocs }: { disableDocs?: boolean }) => {
  const result: Result = {};

  /* Heat up time for playwright and the builder
   * This is to avoid the first run being slower than the rest
   * which can happen due to vite or webpack lazy compilation
   * We visit the story and the docs page, so those should be fully cached
   *
   * We instantiate a new browser for each run to avoid any caching happening in the browser itself
   */
  const x = await benchStory(url);

  if (!disableDocs) {
    await benchAutodocs(url);
  }

  result.storyVisibleUncached = x.storyVisible;

  if (!disableDocs) {
    Object.assign(result, await benchMDX(url));
  }
  Object.assign(result, await benchStory(url));

  if (!disableDocs) {
    Object.assign(result, await benchAutodocs(url));
  }

  return result;
};

async function benchAutodocs(url: string) {
  const result: Result = {};
  const browser = await chromium.launch(/* { headless: false } */);
  await browser.newContext();
  const page = await browser.newPage();
  page.setDefaultTimeout(40000);

  const start = now();
  await page.goto(`${url}?path=/docs/example-button--docs`);

  const tasks = [
    async () => {
      const previewPage = await getPreviewPage(page);
      previewPage.setDefaultTimeout(40000);

      await previewPage.waitForLoadState('load');
      await previewPage.getByText('Primary UI component for user interaction');

      result.autodocsVisible = now() - start;
    },
  ];

  await Promise.all(tasks.map((t) => t()));
  await page.close();

  return result;
}

async function benchMDX(url: string) {
  const result: Result = {};
  const browser = await chromium.launch(/* { headless: false } */);
  await browser.newContext();
  const page = await browser.newPage();

  const start = now();
  await page.goto(`${url}?path=/docs/configure-your-project--docs`);

  const tasks = [
    async () => {
      const previewPage = await getPreviewPage(page);
      previewPage.setDefaultTimeout(40000);

      await previewPage.waitForLoadState('load');
      await previewPage.getByText('Configure your project');

      result.mdxVisible = now() - start;
    },
  ];

  await Promise.all(tasks.map((t) => t()));
  await page.close();

  return result;
}

async function benchStory(url: string) {
  const result: Result = {};
  // change this to true, to see the browser in action
  const browser = await chromium.launch({ headless: true });
  await browser.newContext();
  const page = await browser.newPage();

  const start = now();
  await page.goto(`${url}?path=/story/example-button--primary`);

  const tasks = [
    async () => {
      await page.waitForSelector('.sidebar-header', { state: 'attached' });
      result.managerHeaderVisible = now() - start;
    },
    async () => {
      await page.waitForSelector('#example-button--primary', { state: 'attached' });
      result.managerIndexVisible = now() - start;
    },
    async () => {
      const previewPage = await getPreviewPage(page);
      previewPage.setDefaultTimeout(40000);

      await previewPage.waitForLoadState('load');
      await previewPage.getByText('Button');

      result.storyVisible = now() - start;
    },
  ];

  await Promise.all(tasks.map((t) => t()));
  await page.close();

  return result;
}
