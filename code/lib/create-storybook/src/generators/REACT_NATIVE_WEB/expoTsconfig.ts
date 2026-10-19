import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Expo's exports map sends the extensionless path to tsconfig.base.js, which does not exist.
const EXPO_TSCONFIG_BASE = /("extends"\s*:\s*)(["'])expo\/tsconfig\.base\2/g;

export function rewriteExpoTsconfigBase(source: string): string {
  return source.replace(EXPO_TSCONFIG_BASE, '$1$2expo/tsconfig.base.json$2');
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
