import type { StoryAnnotations } from 'storybook/internal/types';

console.log('addon vitest preview!');

// TODO: maybe this doesn't have to be an explicit preview annotation, but can be automatically added into vitest annotations somehow

const preview: StoryAnnotations = {
  afterEach: async ({ title, name, canvasElement, reporting }) => {
    if (!(globalThis as any).__vitest_browser__) {
      return;
    }
    //TODO: toggle this on an off based on something, probably like a11y
    try {
      console.log(`Taking screenshot for "${name}"`);
      const { page } = await import('@vitest/browser/context');

      const base64 = await page.screenshot({
        path: `screenshots/${title}/${name}.png`,
        base64: true,
        element: canvasElement.firstChild,
      });

      reporting.addReport({
        type: 'screenshot',
        version: 1,
        result: base64,
        status: 'passed',
      });
    } catch (error) {
      console.error('Error taking screenshot', error);
      reporting.addReport({
        type: 'screenshot',
        version: 1,
        result: error,
        status: 'failed',
      });
    }
  },
};

export default preview;
