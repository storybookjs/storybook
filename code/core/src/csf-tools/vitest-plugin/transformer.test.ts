import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStoryTitle } from '@storybook/core/common';

import { type RawSourceMap, SourceMapConsumer } from 'source-map';

import { vitestTransform as originalTransform } from './transformer';

vi.mock('@storybook/core/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@storybook/core/common')>();
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
  describe('no-op', () => {
    it('should return original code if the file is not a story file', async () => {
      const code = `console.log('Not a story file');`;
      const fileName = 'src/components/Button.js';

      const result = await transform({ code, fileName });

      expect(result.code).toMatchInlineSnapshot(`console.log('Not a story file');`);
    });
  });

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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
        const _meta = {
          component: Button,
          title: "automatic/calculated/title"
        };
        export default _meta;
        export const Story = {};
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Story", _testStory("Story", Story, _meta, []));
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
        const _meta = {
          title: "automatic/calculated/title",
          component: Button
        };
        export default _meta;
        export const Story = {};
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Story", _testStory("Story", Story, _meta, []));
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
        const meta = {
          component: Button,
          title: "automatic/calculated/title"
        };
        export default meta;
        export const Story = {};
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Story", _testStory("Story", Story, meta, []));
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
        const meta = {
          title: "automatic/calculated/title",
          component: Button
        };
        export default meta;
        export const Story = {};
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Story", _testStory("Story", Story, meta, []));
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
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
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Primary", _testStory("Primary", Primary, _meta, []));
        }
      `);
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
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
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Primary", _testStory("Primary", Primary, _meta, []));
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
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
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Secondary", _testStory("Secondary", Secondary, _meta, []));
          _test("Primary", _testStory("Primary", Primary, _meta, []));
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
        const _meta = {
          title: "automatic/calculated/title",
          component: Button,
          excludeStories: ['nonStory']
        };
        export default _meta;
        export const Story = {};
        export const nonStory = 123;
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Story", _testStory("Story", Story, _meta, []));
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
        const _meta = {
          title: "automatic/calculated/title"
        };
        export default _meta;
        export const Included = {
          tags: ['include-me']
        };
        export const NotIncluded = {};
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Included", _testStory("Included", Included, _meta, []));
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
        const _meta = {
          title: "automatic/calculated/title"
        };
        export default _meta;
        export const Included = {};
        export const NotIncluded = {
          tags: ['exclude-me']
        };
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Included", _testStory("Included", Included, _meta, []));
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
        const _meta = {
          title: "automatic/calculated/title"
        };
        export default _meta;
        export const Skipped = {
          tags: ['skip-me']
        };
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Skipped", _testStory("Skipped", Skipped, _meta, ["skip-me"]));
        }
      `);
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
        import { testStory as _testStory } from "@storybook/experimental-addon-vitest/internal/test-utils";
        const meta = {
          title: "automatic/calculated/title",
          component: Button
        };
        export default meta;
        export const Primary = {};
        const _isRunningFromThisFile = import.meta.url.includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
        if (_isRunningFromThisFile) {
          _test("Primary", _testStory("Primary", Primary, meta, []));
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

  describe('error handling', () => {
    const warnSpy = vi.spyOn(console, 'warn');
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
