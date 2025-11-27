import path from 'node:path';

import { getTSDiagnostics, getTSFilesAndConfig, getTSProgramAndHost } from './utils/typescript';

const tsconfigPath = 'tsconfig.json';

const { options, fileNames } = getTSFilesAndConfig(tsconfigPath);
const { program, host } = getTSProgramAndHost(fileNames, options);

const tsDiagnostics = getTSDiagnostics(program, process.cwd().replaceAll(path.sep, '/'), host);
if (tsDiagnostics.length > 0) {
  console.log(tsDiagnostics);
  process.exit(1);
} else {
  console.log('no type errors');
}

// TODO, add more package checks here, like:
// - check for missing dependencies/peerDependencies
// - check for unused exports
