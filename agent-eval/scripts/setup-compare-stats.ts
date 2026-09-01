// Installs uv (the only prerequisite of the Python statistics stage) and
// prefetches the interpreter + locked dependencies, so `yarn workspace agent-eval run results:compare`
// works offline afterwards. Users never touch Python tooling directly.
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { findUv } from '../lib/agentic-reference/comparison/uv.ts';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

let uv = findUv();
if (uv === null) {
  console.log('The Python statistics stage needs uv (https://docs.astral.sh/uv/).');
  console.log('Installing it with the official installer (https://astral.sh/uv/install.sh)...');
  const install = spawnSync('sh', ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh'], {
    stdio: 'inherit',
  });
  if (install.status !== 0) {
    console.error('uv installation failed. Install it manually, then re-run this script.');
    process.exit(1);
  }
  uv = findUv();
  if (uv === null) {
    console.error(
      'uv installed but not found on PATH or in ~/.local/bin. Open a new shell and re-run.'
    );
    process.exit(1);
  }
}

console.log('Prefetching the Python interpreter and locked dependencies...');
execFileSync(uv, ['sync', '--script', join(SCRIPTS_DIR, 'compare_stats.py')], { stdio: 'inherit' });
console.log('Done. `yarn workspace agent-eval run results:compare` is ready.');
