import { describe, expect, it, vi } from 'vitest';

import { transform as originalTransform } from './transformer';

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    getStoryTitle: () => 'automatic/calculated/title',
  };
});

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: (val) => true,
});

const transform = async ({
  code,
  id = 'src/components/Button.stories.js',
  options = {
    tags: { include: [], exclude: [], skip: [] },
    configDir: '',
    storybookScript: '',
    skipRunningStorybook: true,
    snapshot: false,
    storybookUrl: '',
    debug: false,
  },
  stories = [],
}) => {
  const transformed = await originalTransform({ code, id, options, stories });
  return typeof transformed === 'string' ? transformed : transformed.code;
};

describe('transformer', () => {
  describe('no-op', () => {
    it('should return original code if the file is not a story file', async () => {
      const code = `console.log('Not a story file');`;
      const id = 'src/components/Button.js';

      const result = await transform({ code, id });

      expect(result).toMatchInlineSnapshot(`console.log('Not a story file');`);
    });
  });

  describe('default exports (meta)', () => {
    it('should add title to inline default export in story file if not present', async () => {
      const code = `
        export default {
          component: Button,
        };
      `;

      const result = await transform({ code });

      expect(result).toMatchInlineSnapshot(`
        const __STORYBOOK_META__ = {
        	title: 'automatic/calculated/title',

                  component: Button,
                };
        export default __STORYBOOK_META__;
              
        import { test as __test } from 'vitest';
        import { composeStories as __composeStories } from 'storybook/internal/preview-api';
        import { testStory as __testStory } from '@storybook/experimental-addon-vitest/internal/test-utils';
      `);
    });

    it('should NOT add title to inline default export in story file if already present', async () => {
      const code = `
        export default {
          title: 'Button',
          component: Button,
        };
      `;

      const result = await transform({ code });

      expect(result).toMatchInlineSnapshot(`
        const __STORYBOOK_META__ = {
                  title: 'Button',
                  component: Button,
                };
        export default __STORYBOOK_META__;
              
        import { test as __test } from 'vitest';
        import { composeStories as __composeStories } from 'storybook/internal/preview-api';
        import { testStory as __testStory } from '@storybook/experimental-addon-vitest/internal/test-utils';
      `);
    });

    it('should add title to const declared default export in story file if not present', async () => {
      const code = `
        const meta = {
          component: Button,
        };
  
        export default meta;
      `;
      const id = 'src/components/Button.stories.js';

      const result = await transform({ code, id });

      expect(result).toMatchInlineSnapshot(`
        const meta = {
        	title: 'automatic/calculated/title',

                  component: Button,
                };
          
                export default meta;
              
        import { test as __test } from 'vitest';
        import { composeStories as __composeStories } from 'storybook/internal/preview-api';
        import { testStory as __testStory } from '@storybook/experimental-addon-vitest/internal/test-utils';
      `);
    });

    it('should NOT add title to const declared default export in story file if already present', async () => {
      const code = `
        const meta = {
          title: 'Button',
          component: Button,
        };
  
        export default meta;
      `;
      const id = 'src/components/Button.stories.js';

      const result = await transform({ code, id });

      expect(result).toMatchInlineSnapshot(`
        const meta = {
                  title: 'Button',
                  component: Button,
                };
          
                export default meta;
              
        import { test as __test } from 'vitest';
        import { composeStories as __composeStories } from 'storybook/internal/preview-api';
        import { testStory as __testStory } from '@storybook/experimental-addon-vitest/internal/test-utils';
      `);
    });
  });

  describe('named exports (stories)', () => {
    it('should add test statement to inline exported stories', async () => {
      const code = `
      export default {}
      export const Primary = {
        args: {
          label: 'Primary Button',
        },
      };
    `;
      const id = 'src/components/Button.stories.js';

      const result = await transform({ code, id });

      expect(result).toMatchInlineSnapshot(`
      const __STORYBOOK_META__ = {
      	title: 'automatic/calculated/title',
      };
      export default __STORYBOOK_META__;
            __test('Primary', __testStory('Primary', import.meta.url, __composeStories, {"include":[],"exclude":[],"skip":[]}));
      export const Primary = {
              args: {
                label: 'Primary Button',
              },
            };
          
      import { test as __test } from 'vitest';
      import { composeStories as __composeStories } from 'storybook/internal/preview-api';
      import { testStory as __testStory } from '@storybook/experimental-addon-vitest/internal/test-utils';
    `);
    });

    it('should add test statement to const declared exported stories', async () => {
      const code = `
      export default {}
      const Primary = {
        args: {
          label: 'Primary Button',
        },
      };

      export { Primary };
    `;
      const id = 'src/components/Button.stories.js';

      const result = await transform({ code, id });

      expect(result).toMatchInlineSnapshot(`
      const __STORYBOOK_META__ = {
      	title: 'automatic/calculated/title',
      };
      export default __STORYBOOK_META__;
            __test('Primary', __testStory('Primary', import.meta.url, __composeStories, {"include":[],"exclude":[],"skip":[]}));
      const Primary = {
              args: {
                label: 'Primary Button',
              },
            };

            export { Primary };
          
      import { test as __test } from 'vitest';
      import { composeStories as __composeStories } from 'storybook/internal/preview-api';
      import { testStory as __testStory } from '@storybook/experimental-addon-vitest/internal/test-utils';
    `);
    });
  });
});
