import { createRequire } from 'node:module';

import { packageRootFromFile, redirectTypeScriptRequires } from 'storybook/internal/component-meta';
import { once } from 'storybook/internal/node-logger';

const require = createRequire(import.meta.url);

type TypeScript = typeof import('typescript');

const MISSING_COMPILER_API_WARNING =
  'TypeScript 7 does not include the compiler API that Storybook uses to extract component ' +
  'metadata for Controls, the Docs args table and the component manifest. Install ' +
  '`@typescript/typescript6` as a dev dependency to enable it.';

const hasCompilerApi = (typescript: TypeScript) => typeof typescript.sys?.fileExists === 'function';

const pointSvelte2tsxAt = (entry: string) => {
  // svelte2tsx can be hoisted above this package and then resolve the project's TypeScript.
  redirectTypeScriptRequires(packageRootFromFile(require.resolve('svelte2tsx')), entry);
};

const loadDocgenTypeScript = (): TypeScript | undefined => {
  let project: TypeScript | undefined;
  try {
    project = require('typescript') as TypeScript;
  } catch {
    project = undefined;
  }

  const major = Number.parseInt(String(project?.version), 10);
  if (project && major < 7 && hasCompilerApi(project)) {
    pointSvelte2tsxAt(require.resolve('typescript'));
    return project;
  }

  try {
    const entry = require.resolve('@typescript/typescript6');
    const typescript6 = require(entry) as TypeScript;
    if (hasCompilerApi(typescript6)) {
      pointSvelte2tsxAt(entry);
      return typescript6;
    }
  } catch {
    // @typescript/typescript6 is an optional peer.
  }

  if (project) {
    once.warn(MISSING_COMPILER_API_WARNING);
  }
  return undefined;
};

export const docgenTypeScript = loadDocgenTypeScript();
