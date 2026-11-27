import { getSourceSnippetRuntime } from 'storybook/internal/docs-tools';
import type { DecoratorFunction } from 'storybook/internal/types';

import './docs/register-print-hole.ts';
import { sourceDecorator } from './docs/sourceDecorator.ts';
import type { SvelteRenderer } from './types.ts';

const snippetRuntime = getSourceSnippetRuntime();

export const decorators: DecoratorFunction<SvelteRenderer>[] =
  snippetRuntime === 'preview' ? [sourceDecorator] : [];
