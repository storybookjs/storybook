import { sourceDecorator } from './docgen/story-docs/source-decorator/sourceDecorator.ts';

const isDocgenServerEnabled = (globalThis as any).FEATURES?.docgenServer;

export const decorators = isDocgenServerEnabled ? [] : [sourceDecorator];
