import { fillTemplate } from './docs/fill-template.ts';
import { sourceDecorator } from './docgen/story-docs/source-decorator/sourceDecorator.ts';

const isDocgenServerEnabled = globalThis.FEATURES?.docgenServer;

export const decorators = isDocgenServerEnabled ? [] : [sourceDecorator];

export const parameters = {
  docs: {
    source: { fillTemplate },
  },
};
