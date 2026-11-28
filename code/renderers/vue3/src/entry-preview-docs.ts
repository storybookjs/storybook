import { getSourceSnippetRuntime } from 'storybook/internal/docs-tools';

import './docs/register-print-hole.ts';
import { sourceDecorator } from './docgen/story-docs/source-decorator/sourceDecorator.ts';

const snippetRuntime = getSourceSnippetRuntime();

export const decorators = snippetRuntime === 'preview' ? [sourceDecorator] : [];
