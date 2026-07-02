import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { join } from 'pathe';

import { getTSDiagnostics, getTSFilesAndConfig, getTSProgramAndHost } from './utils/typescript.ts';

// Computed locally instead of importing ../utils/constants.ts: that module
// intentionally uses __dirname (it must stay loadable from CJS-transpiled
// contexts), while this script runs under native node as an ES module.
const ROOT_DIRECTORY = join(fileURLToPath(import.meta.url), '..', '..', '..');

const {
  values: { cwd },
} = parseArgs({
  options: {
    cwd: { type: 'string' },
  },
  allowNegative: true,
});

const normalizedCwd = cwd ? (isAbsolute(cwd) ? cwd : join(ROOT_DIRECTORY, cwd)) : process.cwd();

const tsconfigPath = join(normalizedCwd, 'tsconfig.json');

if (existsSync(tsconfigPath)) {
  const { options, fileNames } = getTSFilesAndConfig(tsconfigPath, normalizedCwd);
  const { program, host } = getTSProgramAndHost(fileNames, options);

  const tsDiagnostics = getTSDiagnostics(program, normalizedCwd, host);
  if (tsDiagnostics.length > 0) {
    console.log(tsDiagnostics);
    process.exit(1);
  } else if (!process.env.CI) {
    console.log('✅ No type errors');
  }
}

// TODO, add more package checks here, like:
// - check for missing dependencies/peerDependencies
// - check for unused exports
