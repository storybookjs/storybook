import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStoryTitle } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { type RawSourceMap, SourceMapConsumer } from 'source-map';

import { vitestTransform as originalTransform } from './transformer';

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

describe('transformer', () => {
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
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            component: Button,
            title: "automatic/calculated/title"
          };
          export default _meta;
          export const Story = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Story", _testStory({
              exportName: "Story",
              story: Story,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--story"
            }));
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
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            title: "automatic/calculated/title",
            component: Button
          };
          export default _meta;
          export const Story = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Story", _testStory({
              exportName: "Story",
              story: Story,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--story"
            }));
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
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const meta = {
            component: Button,
            title: "automatic/calculated/title"
          };
          export default meta;
          export const Story = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Story", _testStory({
              exportName: "Story",
              story: Story,
              meta: meta,
              skipTags: [],
              storyId: "automatic-calculated-title--story"
            }));
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
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const meta = {
            title: "automatic/calculated/title",
            component: Button
          };
          export default meta;
          export const Story = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Story", _testStory({
              exportName: "Story",
              story: Story,
              meta: meta,
              skipTags: [],
              storyId: "automatic-calculated-title--story"
            }));
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
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
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
            _test("Primary", _testStory({
              exportName: "Primary",
              story: Primary,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--primary"
            }));
          }
        `);
      });

      describe("use the story's name as test title", () => {
        it('should support CSF v3 via name property', async () => {
          const code = `
          export default { component: Button }
          export const Primary = { name: "custom name" };`;
          const result = await transform({ code });

          expect(result.code).toMatchInlineSnapshot(`
            import { test as _test, expect as _expect } from "vitest";
            import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
            const _meta = {
              component: Button,
              title: "automatic/calculated/title"
            };
            export default _meta;
            export const Primary = {
              name: "custom name"
            };
            const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
            if (_isRunningFromThisFile) {
              _test("custom name", _testStory({
                exportName: "Primary",
                story: Primary,
                meta: _meta,
                skipTags: [],
                storyId: "automatic-calculated-title--primary"
              }));
            }
          `);
        });

        it('should support CSF v1/v2 via storyName property', async () => {
          const code = `
          export default { component: Button }
          export const Story = () => {}
          Story.storyName = 'custom name';`;
          const result = await transform({ code: code });
          expect(result.code).toMatchInlineSnapshot(`
            import { test as _test, expect as _expect } from "vitest";
            import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
            const _meta = {
              component: Button,
              title: "automatic/calculated/title"
            };
            export default _meta;
            export const Story = () => {};
            Story.storyName = 'custom name';
            const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
            if (_isRunningFromThisFile) {
              _test("custom name", _testStory({
                exportName: "Story",
                story: Story,
                meta: _meta,
                skipTags: [],
                storyId: "automatic-calculated-title--story"
              }));
            }
          `);
        });
      });

      it('should add test statement to const declared exported stories', async () => {
        const code = `
          export default {};
          const Primary = {
            args: {
              label: 'Primary Button',
            },
          };

          export { Primary };
        `;

        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
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
            _test("Primary", _testStory({
              exportName: "Primary",
              story: Primary,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--primary"
            }));
          }
        `);
      });

      it('should add test statement to const declared renamed exported stories', async () => {
        const code = `
          export default {};
          const Primary = {
            args: {
              label: 'Primary Button',
            },
          };

          export { Primary as PrimaryStory };
        `;

        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            title: "automatic/calculated/title"
          };
          export default _meta;
          const Primary = {
            args: {
              label: 'Primary Button'
            }
          };
          export { Primary as PrimaryStory };
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("PrimaryStory", _testStory({
              exportName: "PrimaryStory",
              story: Primary,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--primary-story"
            }));
          }
        `);
      });

      it('should add tests for multiple stories', async () => {
        const code = `
          export default {};
          const Primary = {
            args: {
              label: 'Primary Button',
            },
          };

          export const Secondary = {}

          export { Primary };
        `;

        const result = await transform({ code });
        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            title: "automatic/calculated/title"
          };
          export default _meta;
          const Primary = {
            args: {
              label: 'Primary Button'
            }
          };
          export const Secondary = {};
          export { Primary };
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Secondary", _testStory({
              exportName: "Secondary",
              story: Secondary,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--secondary"
            }));
            _test("Primary", _testStory({
              exportName: "Primary",
              story: Primary,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--primary"
            }));
          }
        `);
      });

      it('should exclude exports via excludeStories', async () => {
        const code = `
          export default {
            title: 'Button',
            component: Button,
            excludeStories: ['nonStory'],
          }
          export const Story = {};
          export const nonStory = 123
        `;

        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            title: "automatic/calculated/title",
            component: Button,
            excludeStories: ['nonStory']
          };
          export default _meta;
          export const Story = {};
          export const nonStory = 123;
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Story", _testStory({
              exportName: "Story",
              story: Story,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--story"
            }));
          }
        `);
      });

      it('should return a describe with skip if there are no valid stories', async () => {
        const code = `
          export default {
            title: 'Button',
            component: Button,
            tags: ['!test']
          }
          export const Story = {}
        `;
        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, describe as _describe } from "vitest";
          const _meta = {
            title: "automatic/calculated/title",
            component: Button,
            tags: ['!test']
          };
          export default _meta;
          export const Story = {};
          _describe.skip("No valid tests found");
        `);
      });
    });

    describe('tags filtering mechanism', () => {
      it('should only include stories from tags.include', async () => {
        const code = `
          export default {};
          export const Included = { tags: ['include-me'] };

          export const NotIncluded = {}
        `;

        const result = await transform({
          code,
          tagsFilter: { include: ['include-me'], exclude: [], skip: [] },
        });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            title: "automatic/calculated/title"
          };
          export default _meta;
          export const Included = {
            tags: ['include-me']
          };
          export const NotIncluded = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Included", _testStory({
              exportName: "Included",
              story: Included,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--included"
            }));
          }
        `);
      });

      it('should exclude stories from tags.exclude', async () => {
        const code = `
          export default {};
          export const Included = {};

          export const NotIncluded = { tags: ['exclude-me'] }
        `;

        const result = await transform({
          code,
          tagsFilter: { include: ['test'], exclude: ['exclude-me'], skip: [] },
        });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            title: "automatic/calculated/title"
          };
          export default _meta;
          export const Included = {};
          export const NotIncluded = {
            tags: ['exclude-me']
          };
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Included", _testStory({
              exportName: "Included",
              story: Included,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--included"
            }));
          }
        `);
      });

      it('should pass skip tags to testStory call using tags.skip', async () => {
        const code = `
          export default {};
          export const Skipped = { tags: ['skip-me'] };
        `;

        const result = await transform({
          code,
          tagsFilter: { include: ['test'], exclude: [], skip: ['skip-me'] },
        });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            title: "automatic/calculated/title"
          };
          export default _meta;
          export const Skipped = {
            tags: ['skip-me']
          };
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Skipped", _testStory({
              exportName: "Skipped",
              story: Skipped,
              meta: _meta,
              skipTags: ["skip-me"],
              storyId: "automatic-calculated-title--skipped"
            }));
          }
        `);
      });
    });

    describe('component info extraction', () => {
      it('should extract component name from named import specifier', async () => {
        const code = `
        import { Button } from './Button';
        export default {
          component: Button,
        }
        export const Primary = {};
      `;

        const result = await transform({
          code,
        });

        expect(result.code).toContain('componentPath: "./Button"');
        expect(result.code).toContain('componentName: "Button"');
      });
      it('should extract component name from default import specifier', async () => {
        const code = `
        import Button from './Button';
        export default {
          component: Button,
        }
        export const Primary = {};
      `;

        const result = await transform({
          code,
        });

        expect(result.code).toContain('componentPath: "./Button"');
        expect(result.code).toContain('componentName: "Button"');
      });
      it('should extract component name from aliased import specifier', async () => {
        const code = `
        import { Component as Button } from './Button';
        export default {
          component: Button,
        }
        export const Primary = {};
      `;

        const result = await transform({
          code,
        });

        expect(result.code).toContain('componentPath: "./Button"');
        expect(result.code).toContain('componentName: "Button"');
      });
    });

    describe('source map calculation', () => {
      it('should remap the location of an inline named export to its relative testStory function', async () => {
        const originalCode = `
          const meta = {
            title: 'Button',
            component: Button,
          }
          export default meta;
          export const Primary = {};
        `;

        const { code: transformedCode, map } = await transform({
          code: originalCode,
        });

        expect(transformedCode).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const meta = {
            title: "automatic/calculated/title",
            component: Button
          };
          export default meta;
          export const Primary = {};
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Primary", _testStory({
              exportName: "Primary",
              story: Primary,
              meta: meta,
              skipTags: [],
              storyId: "automatic-calculated-title--primary"
            }));
          }
        `);

        const consumer = await new SourceMapConsumer(map as unknown as RawSourceMap);

        // Locate `__test("Primary"...` in the transformed code
        const testPrimaryLine =
          transformedCode.split('\n').findIndex((line) => line.includes('_test("Primary"')) + 1;
        const testPrimaryColumn = transformedCode
          .split('\n')
          [testPrimaryLine - 1].indexOf('_test("Primary"');

        // Get the original position from the source map for `__test("Primary"...`
        const originalPosition = consumer.originalPositionFor({
          line: testPrimaryLine,
          column: testPrimaryColumn,
        });

        // Locate `export const Primary` in the original code
        const originalPrimaryLine =
          originalCode.split('\n').findIndex((line) => line.includes('export const Primary')) + 1;
        const originalPrimaryColumn = originalCode
          .split('\n')
          [originalPrimaryLine - 1].indexOf('export const Primary');

        // The original locations of the transformed code should match with the ones of the original code
        expect(originalPosition.line, 'original line location').toBe(originalPrimaryLine);
        expect(originalPosition.column, 'original column location').toBe(originalPrimaryColumn);
      });
    });
  });

  describe('CSF Factories', () => {
    describe('default exports (meta)', () => {
      it('should add title to inline default export if not present', async () => {
        const code = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({ component: Button });
        export const Story = meta.story({});
      `;

        const result = await transform({ code });

        expect(getStoryTitle).toHaveBeenCalled();

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            component: Button,
            title: "automatic/calculated/title"
          });
          export const Story = meta.story({});
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Story", _testStory({
              exportName: "Story",
              story: Story,
              meta: meta,
              skipTags: [],
              storyId: "automatic-calculated-title--story"
            }));
          }
        `);
      });
    });

    describe('named exports (stories)', () => {
      it("should use the story's name as test title", async () => {
        const code = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({ component: Button });
        export const Primary = meta.story({ name: "custom name" });`;
        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            component: Button,
            title: "automatic/calculated/title"
          });
          export const Primary = meta.story({
            name: "custom name"
          });
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("custom name", _testStory({
              exportName: "Primary",
              story: Primary,
              meta: meta,
              skipTags: [],
              storyId: "automatic-calculated-title--primary"
            }));
          }
        `);
      });

      it('should add test statement to const declared exported stories', async () => {
        const code = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({ component: Button });
        const Primary = meta.story({
          args: {
            label: 'Primary Button',
          }
        });

        export { Primary };
      `;

        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            component: Button,
            title: "automatic/calculated/title"
          });
          const Primary = meta.story({
            args: {
              label: 'Primary Button'
            }
          });
          export { Primary };
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Primary", _testStory({
              exportName: "Primary",
              story: Primary,
              meta: meta,
              skipTags: [],
              storyId: "automatic-calculated-title--primary"
            }));
          }
        `);
      });

      it('should add test statement to const declared renamed exported stories', async () => {
        const code = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({ component: Button });
        const Primary = meta.story({
          args: {
            label: 'Primary Button',
          }
        });

        export { Primary as PrimaryStory };
      `;

        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            component: Button,
            title: "automatic/calculated/title"
          });
          const Primary = meta.story({
            args: {
              label: 'Primary Button'
            }
          });
          export { Primary as PrimaryStory };
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("PrimaryStory", _testStory({
              exportName: "PrimaryStory",
              story: Primary,
              meta: meta,
              skipTags: [],
              storyId: "automatic-calculated-title--primary-story"
            }));
          }
        `);
      });

      it('should add tests for multiple stories', async () => {
        const code = `
        export default {};
        const Primary = {
          args: {
            label: 'Primary Button',
          },
        };

        export const Secondary = {}

        export { Primary };
      `;

        const result = await transform({ code });
        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            title: "automatic/calculated/title"
          };
          export default _meta;
          const Primary = {
            args: {
              label: 'Primary Button'
            }
          };
          export const Secondary = {};
          export { Primary };
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Secondary", _testStory({
              exportName: "Secondary",
              story: Secondary,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--secondary"
            }));
            _test("Primary", _testStory({
              exportName: "Primary",
              story: Primary,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--primary"
            }));
          }
        `);
      });

      it('should exclude exports via excludeStories', async () => {
        const code = `
        export default {
          title: 'Button',
          component: Button,
          excludeStories: ['nonStory'],
        }
        export const Story = {};
        export const nonStory = 123
      `;

        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          const _meta = {
            title: "automatic/calculated/title",
            component: Button,
            excludeStories: ['nonStory']
          };
          export default _meta;
          export const Story = {};
          export const nonStory = 123;
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Story", _testStory({
              exportName: "Story",
              story: Story,
              meta: _meta,
              skipTags: [],
              storyId: "automatic-calculated-title--story"
            }));
          }
        `);
      });

      it('should return a describe with skip if there are no valid stories', async () => {
        const code = `
        export default {
          title: 'Button',
          component: Button,
          tags: ['!test']
        }
        export const Story = {}
      `;
        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
        import { test as _test, describe as _describe } from "vitest";
        const _meta = {
          title: "automatic/calculated/title",
          component: Button,
          tags: ['!test']
        };
        export default _meta;
        export const Story = {};
        _describe.skip("No valid tests found");
      `);
      });
      it('should support test annotation', async () => {
        const code = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({ component: Button });
        export const A = meta.story({});
        A.test("foo", { args: { primary: true }}, () => {});
        A.test("bar", () => {});
      `;

        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect, describe as _describe } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            component: Button,
            title: "automatic/calculated/title"
          });
          export const A = meta.story({});
          A.test("foo", {
            args: {
              primary: true
            }
          }, () => {});
          A.test("bar", () => {});
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _describe("A  ", () => {
              _test("base story", _testStory({
                exportName: "A",
                story: A,
                meta: meta,
                skipTags: [],
                storyId: "automatic-calculated-title--a"
              }));
              _test("foo", _testStory({
                exportName: "A",
                story: A,
                meta: meta,
                skipTags: [],
                storyId: "automatic-calculated-title--a:foo",
                testName: "foo"
              }));
              _test("bar", _testStory({
                exportName: "A",
                story: A,
                meta: meta,
                skipTags: [],
                storyId: "automatic-calculated-title--a:bar",
                testName: "bar"
              }));
            });
          }
        `);
      });
    });

    describe('test syntax', () => {
      it('should add test statement to story tests', async () => {
        const code = `
          import { config } from '#.storybook/preview';
          const meta = config.meta({});
          export const Primary = meta.story({});
          Primary.test("foo", () => {});
        `;
        const result = await transform({ code });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect, describe as _describe } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            title: "automatic/calculated/title"
          });
          export const Primary = meta.story({});
          Primary.test("foo", () => {});
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _describe("Primary  ", () => {
              _test("base story", _testStory({
                exportName: "Primary",
                story: Primary,
                meta: meta,
                skipTags: [],
                storyId: "automatic-calculated-title--primary"
              }));
              _test("foo", _testStory({
                exportName: "Primary",
                story: Primary,
                meta: meta,
                skipTags: [],
                storyId: "automatic-calculated-title--primary:foo",
                testName: "foo"
              }));
            });
          }
        `);
      });
    });

    describe('tags filtering mechanism', () => {
      it('should only include stories from tags.include', async () => {
        const code = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({});
        export const Included = meta.story({ tags: ['include-me'] });

        export const NotIncluded = meta.story({});
      `;

        const result = await transform({
          code,
          tagsFilter: { include: ['include-me'], exclude: [], skip: [] },
        });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            title: "automatic/calculated/title"
          });
          export const Included = meta.story({
            tags: ['include-me']
          });
          export const NotIncluded = meta.story({});
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Included", _testStory({
              exportName: "Included",
              story: Included,
              meta: meta,
              skipTags: [],
              storyId: "automatic-calculated-title--included"
            }));
          }
        `);
      });

      it('should exclude stories from tags.exclude', async () => {
        const code = `
          import { config } from '#.storybook/preview';
          const meta = config.meta({});
          export const Included = meta.story({});

          export const NotIncluded = meta.story({ tags: ['exclude-me'] });
        `;

        const result = await transform({
          code,
          tagsFilter: { include: ['test'], exclude: ['exclude-me'], skip: [] },
        });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            title: "automatic/calculated/title"
          });
          export const Included = meta.story({});
          export const NotIncluded = meta.story({
            tags: ['exclude-me']
          });
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Included", _testStory({
              exportName: "Included",
              story: Included,
              meta: meta,
              skipTags: [],
              storyId: "automatic-calculated-title--included"
            }));
          }
        `);
      });

      it('should pass skip tags to testStory call using tags.skip', async () => {
        const code = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({});
        export const Skipped = meta.story({ tags: ['skip-me'] });
      `;

        const result = await transform({
          code,
          tagsFilter: { include: ['test'], exclude: [], skip: ['skip-me'] },
        });

        expect(result.code).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            title: "automatic/calculated/title"
          });
          export const Skipped = meta.story({
            tags: ['skip-me']
          });
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _test("Skipped", _testStory({
              exportName: "Skipped",
              story: Skipped,
              meta: meta,
              skipTags: ["skip-me"],
              storyId: "automatic-calculated-title--skipped"
            }));
          }
        `);
      });
    });

    describe('source map calculation', () => {
      it('should remap the location of an inline named export to its relative testStory function', async () => {
        const originalCode = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({});
        export const Primary = meta.story({});
        Primary.test("foo", () => {});
      `;

        const { code: transformedCode, map } = await transform({
          code: originalCode,
        });

        expect(transformedCode).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect, describe as _describe } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            title: "automatic/calculated/title"
          });
          export const Primary = meta.story({});
          Primary.test("foo", () => {});
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _describe("Primary  ", () => {
              _test("base story", _testStory({
                exportName: "Primary",
                story: Primary,
                meta: meta,
                skipTags: [],
                storyId: "automatic-calculated-title--primary"
              }));
              _test("foo", _testStory({
                exportName: "Primary",
                story: Primary,
                meta: meta,
                skipTags: [],
                storyId: "automatic-calculated-title--primary:foo",
                testName: "foo"
              }));
            });
          }
        `);

        const consumer = await new SourceMapConsumer(map as unknown as RawSourceMap);

        // Locate `_test("base story"...` in the transformed code
        const testPrimaryLine =
          transformedCode.split('\n').findIndex((line) => line.includes('_test("base story"')) + 1;
        const testPrimaryColumn = transformedCode
          .split('\n')
          [testPrimaryLine - 1].indexOf('_test("base story"');

        // Get the original position from the source map for `_test("base story"...`
        const originalPosition = consumer.originalPositionFor({
          line: testPrimaryLine,
          column: testPrimaryColumn,
        });

        // Locate `export const Primary` in the original code
        const originalPrimaryLine =
          originalCode.split('\n').findIndex((line) => line.includes('export const Primary')) + 1;
        const originalPrimaryColumn = originalCode
          .split('\n')
          [originalPrimaryLine - 1].indexOf('export const Primary');

        // The original locations of the transformed code should match with the ones of the original code
        expect(originalPosition.line, 'original line location').toBe(originalPrimaryLine);
        expect(originalPosition.column, 'original column location').toBe(originalPrimaryColumn);
      });

      it.skip('should remap the location of story tests', async () => {
        const originalCode = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({});
        export const Primary = meta.story({});
        Primary.test("foo", () => {});
      `;

        const { code: transformedCode, map } = await transform({
          code: originalCode,
        });

        expect(transformedCode).toMatchInlineSnapshot(`
          import { test as _test, expect as _expect, describe as _describe } from "vitest";
          import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
          import { config } from '#.storybook/preview';
          const meta = config.meta({
            title: "automatic/calculated/title"
          });
          export const Primary = meta.story({});
          Primary.test("foo", () => {});
          const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
          if (_isRunningFromThisFile) {
            _describe("Primary", () => {
              _test("base story", _testStory("Primary", Primary, meta, []));
              _test("foo", _testStory("Primary", Primary, meta, [], "foo"));
            });
          }
        `);

        const consumer = await new SourceMapConsumer(map as unknown as RawSourceMap);

        // Locate `_test("render test"...` in the transformed code
        const testPrimaryLine =
          transformedCode.split('\n').findIndex((line) => line.includes('_test("render test"')) + 1;
        const testPrimaryColumn = transformedCode
          .split('\n')
          [testPrimaryLine - 1].indexOf('_test("render test"');

        // Get the original position from the source map for `_test("render test"...`
        const originalPosition = consumer.originalPositionFor({
          line: testPrimaryLine,
          column: testPrimaryColumn,
        });

        // Locate `export const Primary` in the original code
        const originalPrimaryLine =
          originalCode.split('\n').findIndex((line) => line.includes('export const Primary')) + 1;
        const originalPrimaryColumn = originalCode
          .split('\n')
          [originalPrimaryLine - 1].indexOf('export const Primary');

        // The original locations of the transformed code should match with the ones of the original code
        expect(originalPosition.line, 'original line location').toBe(originalPrimaryLine);
        expect(originalPosition.column, 'original column location').toBe(originalPrimaryColumn);

        // Locate `_test("foo"...` in the transformed code
        const storyTestLine =
          transformedCode.split('\n').findIndex((line) => line.includes('_test("foo"')) + 1;
        const storyTestColumn = transformedCode
          .split('\n')
          [storyTestLine - 1].indexOf('_test("foo"');

        // Get the original position from the source map for `_test("foo"...`
        const originalTestPosition = consumer.originalPositionFor({
          line: storyTestLine,
          column: storyTestColumn,
        });

        // Locate `Primary.test("foo"'` in the original code
        const originalStoryTestLine =
          originalCode.split('\n').findIndex((line) => line.includes('Primary.test("foo"')) + 1;
        const originalStoryTestColumn = originalCode
          .split('\n')
          [originalStoryTestLine - 1].indexOf('Primary.test("foo"');

        // The original locations of the transformed code should match with the ones of the original code
        expect(originalTestPosition.line, 'original line location').toBe(originalStoryTestLine);
        expect(originalTestPosition.column, 'original column location').toBe(
          originalStoryTestColumn
        );
      });
    });
  });

  describe('error handling', () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    beforeEach(() => {
      vi.mocked(getStoryTitle).mockRestore();
      warnSpy.mockReset();
    });

    it('should warn when autotitle is not successful', async () => {
      const code = `
        export default {}
        export const Primary = {};
      `;

      vi.mocked(getStoryTitle).mockImplementation(() => undefined);

      warnSpy.mockImplementation(() => {});

      await transform({ code });
      expect(warnSpy.mock.calls[0]).toMatchInlineSnapshot(`
        [Storybook]: Could not calculate story title for "src/components/Button.stories.js".
        Please make sure that this file matches the globs included in the "stories" field in your Storybook configuration at ".storybook".
      `);
    });

    it('should warn when on unsupported story formats', async () => {
      const code = `
        export default {}
        export { Primary } from './Button.stories';
      `;

      warnSpy.mockImplementation(() => {});

      await transform({ code });
      expect(warnSpy.mock.calls[0]).toMatchInlineSnapshot(`
        [Storybook]: Could not transform "Primary" story into test at "src/components/Button.stories.js".
        Please make sure to define stories in the same file and not re-export stories coming from other files".
      `);
    });
  });
});
