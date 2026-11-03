import { fillTemplate } from './docs/fill-template.ts';
import { sourceDecorator } from './docgen/story-docs/source-decorator/sourceDecorator.ts';

const isDocgenServerEnabled = globalThis.FEATURES?.docgenServer;

export const decorators = isDocgenServerEnabled ? [] : [sourceDecorator];

// Under the docgen server, the story-docs `template` follows the controls, filled with the args.
export const parameters = isDocgenServerEnabled ? { docs: { source: { fillTemplate } } } : {};
