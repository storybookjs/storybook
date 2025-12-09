import { resolvePackageDir } from 'storybook/internal/common';

import { buildSync } from 'esbuild';
import { join } from 'pathe';

const runtimeTemplatePath = join(
  resolvePackageDir('storybook'),
  'assets',
  'server',
  'mocker-runtime.template.js'
);

export function getMockerRuntime(absWorkingDir = process.cwd()) {
  // Use esbuild to bundle the runtime script and its dependencies (`@vitest/mocker`, etc.)
  // into a single, self-contained string of code.
  const bundleResult = buildSync({
    entryPoints: [runtimeTemplatePath],
    bundle: true,
    write: false, // Return the result in memory instead of writing to disk
    format: 'esm',
    target: 'es2020',
    external: ['msw/browser', 'msw/core/http'],
    absWorkingDir, // Tell esbuild where to resolve modules from
  });

  const runtimeScriptContent = bundleResult.outputFiles[0].text;

  return runtimeScriptContent;
}
