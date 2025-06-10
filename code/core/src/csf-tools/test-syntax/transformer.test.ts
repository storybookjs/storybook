import { describe, expect, it, vi } from 'vitest';

import dedent from 'ts-dedent';

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

const transform = async ({ code = '', fileName = 'src/components/Button.stories.js' }) => {
  const transformed = await originalTransform({
    code,
    fileName,
  });
  if (typeof transformed === 'string') {
    return { code: transformed, map: null };
  }

  return transformed;
};

describe('transformer', () => {
  describe('test syntax', () => {
    it('should no-op in non-CSF4 stories', async () => {
      const code = dedent`
        export default {};
        export const Primary = {};
      `;

      const result = await transform({ code });

      expect(result.code).toMatchInlineSnapshot(`
        export default {};
        export const Primary = {};
      `);
    });
    it('should add test statement to const declared exported stories', async () => {
      const code = `
        import preview from '#.storybook/preview';
        const meta = preview.meta({ component: Button });
        export const Primary = meta.story({ 
          args: {
            label: 'Primary Button',
          }
        });
        
        Primary.test('just a log', () => {
          console.log('test');
        });
        Primary.test('using context', (context) => {
          const button = context.canvas.getByRole('button');
        });
        Primary.test('destructuring context', async ({ canvas }) => {
          const button = await canvas.findByRole('button');
        });
      `;

      const result = await transform({ code });

      expect(result.code).toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';
        const meta = preview.meta({
          component: Button
        });
        export const Primary = meta.story({
          args: {
            label: 'Primary Button'
          }
        });
        export const PrimaryJustALog = meta.story({
          ...Primary.composed,
          tags: ["test-fn"],
          play: async context => {
            await Primary.play(context);
            console.log('test');
          },
          name: "Primary: just a log"
        });
        export const PrimaryUsingContext = meta.story({
          ...Primary.composed,
          tags: ["test-fn"],
          play: async context => {
            await Primary.play(context);
            const button = context.canvas.getByRole('button');
          },
          name: "Primary: using context"
        });
        export const PrimaryDestructuringContext = meta.story({
          ...Primary.composed,
          tags: ["test-fn"],
          play: async context => {
            await Primary.play(context);
            const {
              canvas
            } = context;
            const button = await canvas.findByRole('button');
          },
          name: "Primary: destructuring context"
        });
      `);
    });
  });
});
