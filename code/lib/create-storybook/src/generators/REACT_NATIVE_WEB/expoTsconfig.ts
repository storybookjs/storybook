import { readFile, writeFile } from 'node:fs/promises';

import { join } from 'pathe';

// Expo's exports map sends the extensionless path to tsconfig.base.js, which does not exist.
// Match the quoted path so both `"extends": "expo/tsconfig.base"` and an extends array are covered.
const EXPO_TSCONFIG_BASE = /(["'])expo\/tsconfig\.base\1/g;
// Only touch the top-level `extends` field's value, so unrelated strings (e.g. a
// `compilerOptions.paths` entry or a comment) that happen to match are left alone.
const EXTENDS_FIELD = /"extends"\s*:\s*(\[[^\]]*\]|"[^"]*"|'[^']*')/;

export function rewriteExpoTsconfigBase(source: string): string {
  return source.replace(EXTENDS_FIELD, (field, value: string) =>
    field.replace(value, value.replace(EXPO_TSCONFIG_BASE, '$1expo/tsconfig.base.json$1'))
  );
}

export async function rewriteExpoTsconfigFile(projectDir: string): Promise<void> {
  const tsconfigPath = join(projectDir, 'tsconfig.json');
  let source: string;
  try {
    source = await readFile(tsconfigPath, 'utf8');
  } catch {
    return;
  }

  const rewritten = rewriteExpoTsconfigBase(source);
  if (rewritten !== source) {
    await writeFile(tsconfigPath, rewritten);
  }
}
