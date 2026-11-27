import { getSourceSnippetRuntime } from 'storybook/internal/docs-tools';

import { printHole } from './docs/print-hole.ts';
import { sourceDecorator } from './docgen/story-docs/source-decorator/sourceDecorator.ts';

const snippetRuntime = getSourceSnippetRuntime();

export const decorators = snippetRuntime === 'preview' ? [sourceDecorator] : [];

// The story-docs `template` follows the controls, filled with the args.
export const parameters = snippetRuntime === 'server' ? { docs: { source: { printHole } } } : {};
