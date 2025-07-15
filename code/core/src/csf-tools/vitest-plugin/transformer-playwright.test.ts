import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStoryTitle } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { type RawSourceMap, SourceMapConsumer } from 'source-map';

import { vitestPlaywrightTransform as originalTransform } from './transformer-playwright';

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    getStoryTitle: vi.fn(() => 'automatic/calculated/title'),
  };
});

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: (val) => true,
});

const transform = async ({
  code = '',
  fileName = 'src/components/Button.stories.js',
  tagsFilter = {
    include: ['test'],
    exclude: [] as string[],
    skip: [] as string[],
  },
  configDir = '.storybook',
  stories = [],
  previewLevelTags = [],
}) => {
  const transformed = await originalTransform({
    code,
    fileName,
    configDir,
    stories,
    tagsFilter,
    previewLevelTags,
  });
  if (typeof transformed === 'string') {
    return { code: transformed, map: null };
  }

  return transformed;
};

describe('transformer-playwright', () => {
  describe('no-op', () => {
    it('should return original code if the file is not a story file', async () => {
      const code = `console.log('Not a story file');`;
      const fileName = 'src/components/Button.js';

      const result = await transform({ code, fileName });

      expect(result.code).toMatchInlineSnapshot(`console.log('Not a story file');`);
    });
  });

  describe('CSF v1/v2/v3', () => {
    describe('default exports (meta)', () => {
      it('should add title to inline default export if not present', async () => {
        const code = `
          export default {
            component: Button,
          };
          export const Story = {};
        `;

        const result = await transform({ code });

        expect(getStoryTitle).toHaveBeenCalled();

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, beforeAll as _beforeAll, afterAll as _afterAll, expect as _expect } from "vitest";
          import { chromium } from "playwright";
          import { convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { testStory as _testStory, prepareScript as _prepareScript, setupPageScript as _setupPageScript } from "@storybook/addon-vitest/internal/playwright-utils";
          const _meta = {
            component: Button,
            title: "automatic/calculated/title"
          };
          export default _meta;
          export const Story = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            let browser;
            let page;
            _beforeAll(async () => {
              const options = {
                headless: false
              };
              browser = await chromium.launch(options);
              page = await browser.newPage();
              await _prepareScript(page);
              await _setupPageScript(page);
            });
            _afterAll(async () => {
              await browser.close();
            });
            _test("Story", _testStory("automatic-calculated-title--story", page));
          }
        `);
      });

      it('should overwrite title to inline default export if already present', async () => {
        const code = `
          export default {
            title: 'Button',
            component: Button,
          };
          export const Story = {};
        `;

        const result = await transform({ code });

        expect(getStoryTitle).toHaveBeenCalled();

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, beforeAll as _beforeAll, afterAll as _afterAll, expect as _expect } from "vitest";
          import { chromium } from "playwright";
          import { convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { testStory as _testStory, prepareScript as _prepareScript, setupPageScript as _setupPageScript } from "@storybook/addon-vitest/internal/playwright-utils";
          const _meta = {
            title: "automatic/calculated/title",
            component: Button
          };
          export default _meta;
          export const Story = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            let browser;
            let page;
            _beforeAll(async () => {
              const options = {
                headless: false
              };
              browser = await chromium.launch(options);
              page = await browser.newPage();
              await _prepareScript(page);
              await _setupPageScript(page);
            });
            _afterAll(async () => {
              await browser.close();
            });
            _test("Story", _testStory("automatic-calculated-title--story", page));
          }
        `);
      });

      it('should add title to const declared default export if not present', async () => {
        const code = `
          const meta = {
            component: Button,
          };
          export default meta;
  
          export const Story = {};
        `;

        const result = await transform({ code });

        expect(getStoryTitle).toHaveBeenCalled();

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, beforeAll as _beforeAll, afterAll as _afterAll, expect as _expect } from "vitest";
          import { chromium } from "playwright";
          import { convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { testStory as _testStory, prepareScript as _prepareScript, setupPageScript as _setupPageScript } from "@storybook/addon-vitest/internal/playwright-utils";
          const meta = {
            component: Button,
            title: "automatic/calculated/title"
          };
          export default meta;
          export const Story = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            let browser;
            let page;
            _beforeAll(async () => {
              const options = {
                headless: false
              };
              browser = await chromium.launch(options);
              page = await browser.newPage();
              await _prepareScript(page);
              await _setupPageScript(page);
            });
            _afterAll(async () => {
              await browser.close();
            });
            _test("Story", _testStory("automatic-calculated-title--story", page));
          }
        `);
      });

      it('should overwrite title to const declared default export if already present', async () => {
        const code = `
          const meta = {
            title: 'Button',
            component: Button,
          };  
          export default meta;
  
          export const Story = {};
        `;

        const result = await transform({ code });

        expect(getStoryTitle).toHaveBeenCalled();

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, beforeAll as _beforeAll, afterAll as _afterAll, expect as _expect } from "vitest";
          import { chromium } from "playwright";
          import { convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { testStory as _testStory, prepareScript as _prepareScript, setupPageScript as _setupPageScript } from "@storybook/addon-vitest/internal/playwright-utils";
          const meta = {
            title: "automatic/calculated/title",
            component: Button
          };
          export default meta;
          export const Story = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            let browser;
            let page;
            _beforeAll(async () => {
              const options = {
                headless: false
              };
              browser = await chromium.launch(options);
              page = await browser.newPage();
              await _prepareScript(page);
              await _setupPageScript(page);
            });
            _afterAll(async () => {
              await browser.close();
            });
            _test("Story", _testStory("automatic-calculated-title--story", page));
          }
        `);
      });
    });

    describe('named exports (stories)', () => {
      it('should add test statement to inline exported stories', async () => {
        const code = `
          export default {
            component: Button,
          }
          export const Primary = {
            args: {
              label: 'Primary Button',
            },
          };
        `;

        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, beforeAll as _beforeAll, afterAll as _afterAll, expect as _expect } from "vitest";
          import { chromium } from "playwright";
          import { convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { testStory as _testStory, prepareScript as _prepareScript, setupPageScript as _setupPageScript } from "@storybook/addon-vitest/internal/playwright-utils";
          const _meta = {
            component: Button,
            title: "automatic/calculated/title"
          };
          export default _meta;
          export const Primary = {
            args: {
              label: 'Primary Button'
            }
          };
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            let browser;
            let page;
            _beforeAll(async () => {
              const options = {
                headless: false
              };
              browser = await chromium.launch(options);
              page = await browser.newPage();
              await _prepareScript(page);
              await _setupPageScript(page);
            });
            _afterAll(async () => {
              await browser.close();
            });
            _test("Primary", _testStory("automatic-calculated-title--primary", page));
          }
        `);
      });

      it('should add test statement to const declared exported stories', async () => {
        const code = `
          export default {
            component: Button,
          }
          const Primary = {
            args: {
              label: 'Primary Button',
            },
          };
          export { Primary };
        `;

        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, beforeAll as _beforeAll, afterAll as _afterAll, expect as _expect } from "vitest";
          import { chromium } from "playwright";
          import { convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { testStory as _testStory, prepareScript as _prepareScript, setupPageScript as _setupPageScript } from "@storybook/addon-vitest/internal/playwright-utils";
          const _meta = {
            component: Button,
            title: "automatic/calculated/title"
          };
          export default _meta;
          const Primary = {
            args: {
              label: 'Primary Button'
            }
          };
          export { Primary };
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            let browser;
            let page;
            _beforeAll(async () => {
              const options = {
                headless: false
              };
              browser = await chromium.launch(options);
              page = await browser.newPage();
              await _prepareScript(page);
              await _setupPageScript(page);
            });
            _afterAll(async () => {
              await browser.close();
            });
            _test("Primary", _testStory("automatic-calculated-title--primary", page));
          }
        `);
      });
    });

    describe('tags', () => {
      it('should skip stories with excluded tags', async () => {
        const code = `
          export default {
            component: Button,
            tags: ['skip-test'],
          }
          export const Primary = {
            args: {
              label: 'Primary Button',
            },
          };
        `;

        const result = await transform({
          code,
          tagsFilter: {
            include: ['test'],
            exclude: ['skip-test'],
            skip: [],
          },
        });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, describe as _describe } from "vitest";
          const _meta = {
            component: Button,
            tags: ['skip-test'],
            title: "automatic/calculated/title"
          };
          export default _meta;
          export const Primary = {
            args: {
              label: 'Primary Button'
            }
          };
          _describe.skip("No valid tests found");
        `);
      });

      it('should skip stories without included tags', async () => {
        const code = `
          export default {
            component: Button,
          }
          export const Primary = {
            args: {
              label: 'Primary Button',
            },
          };
        `;

        const result = await transform({
          code,
          tagsFilter: {
            include: ['e2e'],
            exclude: [],
            skip: [],
          },
        });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, describe as _describe } from "vitest";
          const _meta = {
            component: Button,
            title: "automatic/calculated/title"
          };
          export default _meta;
          export const Primary = {
            args: {
              label: 'Primary Button'
            }
          };
          _describe.skip("No valid tests found");
        `);
      });
    });
  });
});
