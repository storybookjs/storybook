import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROMPTS_DIR } from './utils';

/**
 * Load and return the setup prompt.
 *
 * If a custom prompt file is specified, it takes precedence.
 * Otherwise, the built-in `prompts/setup.md` is used.
 */
export function generatePrompt(promptFile?: string): string {
  const file = promptFile ? resolve(promptFile) : resolve(PROMPTS_DIR, 'setup.md');

  if (!existsSync(file)) {
    throw new Error(`Prompt file not found: ${file}`);
  }

  return readFileSync(file, 'utf-8');
}
