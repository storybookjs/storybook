import { sourceDecorator } from './docs/sourceDecorator.ts';

const isDocgenServerEnabled = globalThis.FEATURES?.experimentalDocgenServer;

export const decorators = isDocgenServerEnabled ? [] : [sourceDecorator];
