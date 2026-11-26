import { getSourceSnippetRuntime } from 'storybook/internal/docs-tools';
import type { DecoratorFunction } from 'storybook/internal/types';

import { printHole } from './docs/print-hole.ts';
import { sourceDecorator } from './docs/sourceDecorator.ts';
import type { SvelteRenderer } from './types.ts';

const snippetRuntime = getSourceSnippetRuntime();

export const decorators: DecoratorFunction<SvelteRenderer>[] =
  snippetRuntime === 'preview' ? [sourceDecorator] : [];

// The story-docs `template` follows the controls, filled with the args.
export const parameters = snippetRuntime === 'server' ? { docs: { source: { printHole } } } : {};
