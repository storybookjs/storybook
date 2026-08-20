import { sourceDecorator } from './docs/sourceDecorator.ts';

const isDocgenServerEnabled = (globalThis as any).FEATURES?.experimentalDocgenServer;

export const decorators = isDocgenServerEnabled ? [] : [sourceDecorator];
