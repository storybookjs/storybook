import { describe, expect, it, vi } from 'vitest';

import { testTransform as originalTransform } from './transformer';

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
  configDir = '.storybook',
  stories = [],
}) => {
  const transformed = await originalTransform({
    code,
    fileName,
    configDir,
    stories,
  });
  if (typeof transformed === 'string') {
    return { code: transformed, map: null };
  }

  return transformed;
};

describe('transformer', () => {
  describe('test syntax', () => {
    it('should add test statement to const declared exported stories', async () => {
      const code = `
        import { config } from '#.storybook/preview';
        const meta = config.meta({ component: Button });
        export const Primary = meta.story({ 
          args: {
            label: 'Primary Button',
          }
        });
        
        Primary.test('some test name here', () => {
          console.log('test');
        });
        Primary.test('something else here too', () => {
          console.log('test');
        });
      `;

      const result = await transform({ code });

      expect(result.code).toMatchInlineSnapshot(`
        import { config } from '#.storybook/preview';
        const meta = config.meta({
          component: Button,
          title: "automatic/calculated/title"
        });
        export const Primary = meta.story({
          args: {
            label: 'Primary Button'
          }
        });
        export const _test = {
          ...Primary,
          tags: [...Primary?.tags, "test-fn"],
          play: async context => {
            await (Primary?.play)();
            console.log('test');
          },
          storyName: "Primary: some test name here"
        };
        export const _test2 = {
          ...Primary,
          tags: [...Primary?.tags, "test-fn"],
          play: async context => {
            await (Primary?.play)();
            console.log('test');
          },
          storyName: "Primary: something else here too"
        };
      `);
    });
  });
});
