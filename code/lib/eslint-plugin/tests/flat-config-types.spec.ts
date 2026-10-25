import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { dirname, join } from 'pathe';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '../../../..');
const distDts = join(currentDir, '../dist/index.d.ts');
const fixturePath = join(currentDir, 'typecheck-fixture.ts');

function checkType(code: string): { code: number; message: string }[] {
  const options: ts.CompilerOptions = {
    exactOptionalPropertyTypes: true,
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  };

  const host = ts.createCompilerHost(options);
  const origGetSourceFile = host.getSourceFile;
  host.getSourceFile = (fileName, ...args) => {
    if (fileName === fixturePath) {
      return ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2022);
    }
    return origGetSourceFile.call(host, fileName, ...args);
  };

  const program = ts.createProgram([fixturePath], options, host);
  const diags = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && d.file.fileName === fixturePath);

  return diags.map((d) => ({
    code: d.code,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
  }));
}

describe('flat configs exactOptionalPropertyTypes compatibility', () => {
  beforeAll(() => {
    if (!existsSync(distDts)) {
      execSync(
        'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ./scripts/build/build-package.ts --cwd code/lib/eslint-plugin --prod',
        {
          cwd: repoRoot,
          stdio: 'pipe',
        }
      );
    }
  });

  it.each(['flat/recommended', 'flat/csf', 'flat/csf-strict', 'flat/addon-interactions'])(
    'assigns %s to TSESLint.FlatConfig.Config[] without TS2322 under exactOptionalPropertyTypes',
    (configName) => {
      const code = `
      import type { TSESLint } from '@typescript-eslint/utils';
      import plugin from '../dist/index.js';

      const config: TSESLint.FlatConfig.Config[] = plugin.configs['${configName}'];
    `;
      const errors = checkType(code);
      expect(errors).toEqual([]);
    }
  );

  it('is compatible with defineConfig({ extends: [...] }) pattern under exactOptionalPropertyTypes', () => {
    const code = `
      import type { TSESLint } from '@typescript-eslint/utils';
      import plugin from '../dist/index.js';

      declare function defineConfig(config: {
        extends?: (TSESLint.FlatConfig.Config | TSESLint.FlatConfig.Config[])[];
      }): void;

      defineConfig({
        extends: [plugin.configs['flat/recommended']],
      });
    `;
    const errors = checkType(code);
    expect(errors).toEqual([]);
  });
});
