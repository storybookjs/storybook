import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'pathe';

const AGE_GATE_KEY = /^[ \t]*npmMinimalAgeGate[ \t]*:/m;
const AGE_GATE_LINE = /^([ \t]*npmMinimalAgeGate[ \t]*:)[^\r\n]*$/gm;

// Yarn 4's default gate is 1 day, so the key has to be 0 rather than absent.
export async function disableNpmMinimalAgeGate(sandboxDir: string) {
  const configPath = join(sandboxDir, '.yarnrc.yml');

  let content = '';
  try {
    content = await readFile(configPath, 'utf-8');
  } catch (error) {
    if (!isEnoent(error)) {
      throw error;
    }
  }

  const next = AGE_GATE_KEY.test(content)
    ? content.replace(AGE_GATE_LINE, '$1 0')
    : `${content}${content.length > 0 && !content.endsWith('\n') ? '\n' : ''}npmMinimalAgeGate: 0\n`;

  await writeFile(configPath, next);
}

function isEnoent(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
