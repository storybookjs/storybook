import { existsSync, readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';

import { join, relative } from 'pathe';
import ts from 'typescript';

const MODULE_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

export function findUndeclaredNodeTypes(packageDir: string): string | undefined {
  const tsconfigPath = join(packageDir, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    return undefined;
  }

  const config = ts.getParsedCommandLineOfConfigFile(
    tsconfigPath,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} }
  );
  const importer = config?.fileNames.find((file) =>
    [...readFileSync(file, 'utf8').matchAll(MODULE_SPECIFIER)].some(([, specifier]) =>
      isBuiltin(specifier)
    )
  );
  if (!config || !importer) {
    return undefined;
  }

  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const declared = { ...manifest.dependencies, ...manifest.devDependencies };
  const missing = [
    ...(config.options.types?.includes('node') ? [] : ['list "node" in compilerOptions.types']),
    ...(declared['@types/node'] ? [] : ['declare @types/node in devDependencies']),
  ];
  if (missing.length === 0) {
    return undefined;
  }

  return [
    `${relative(packageDir, importer)} imports a Node built-in, so this package must ${missing.join(' and ')}.`,
    'Since TypeScript 6, @types packages are only included when listed, so without this the',
    'Node types arrive only if a dependency happens to reference them.',
  ].join('\n');
}
