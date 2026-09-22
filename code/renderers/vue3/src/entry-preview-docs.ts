import { sourceDecorator } from './docgen/story-docs/source-decorator/sourceDecorator.ts';

const isDocgenServerEnabled = (globalThis as any).FEATURES?.experimentalDocgenServer;

export const decorators = isDocgenServerEnabled ? [] : [sourceDecorator];
