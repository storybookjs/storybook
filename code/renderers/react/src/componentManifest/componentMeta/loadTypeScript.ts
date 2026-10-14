import { loadTypeScriptCompilerApi } from 'storybook/internal/component-meta';

import type ts from 'typescript';

export const loadTypeScript = () =>
  loadTypeScriptCompilerApi<typeof ts>({
    typescript: () => import('typescript'),
    typescript6: () => import('@typescript/typescript6'),
  });
