import { loadComponentDocgen } from './docgen-render/component-docgen.ts';
import { render } from './render.ts';
import type { StoryContext } from './types.ts';

export { render, renderToCanvas } from './render.ts';

export const beforeEach = [
  async (context: StoryContext): Promise<void> => {
    // A custom render never reads the server argTypes, so it should not wait for them.
    if (context.originalStoryFn === render) {
      await loadComponentDocgen(context);
    }
  },
];

export const parameters = {
  renderer: 'web-components',
};
