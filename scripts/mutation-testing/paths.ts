import { join } from 'pathe';

export const ROOT = join(import.meta.dirname, '..', '..');
export const OUTPUT_DIR = join(ROOT, '.cache', 'mutation-testing');
