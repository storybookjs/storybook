import { sep } from 'node:path';

import { execCommandCountLines } from './exec-command-count-lines';
import { runTelemetryOperation } from './run-telemetry-operation';

// We are looking for files with the word "page" or "screen" somewhere in them with these exts
const nameMatches = ['page', 'screen'];
const extensions = ['js', 'jsx', 'ts', 'tsx'];

export const getApplicationFilesCountUncached = async (basePath: string) => {
  const bothCasesNameMatches = nameMatches.flatMap((match) => [
    match,
    [match[0].toUpperCase(), ...match.slice(1)].join(''),
  ]);

  const globs = bothCasesNameMatches.flatMap((match) =>
    extensions.map((extension) => `"${basePath}${sep}*${match}*.${extension}"`)
  );

  try {
    const command = `git ls-files -- ${globs.join(' ')}`;
    return await execCommandCountLines(command);
  } catch {
    return undefined;
  }
};

export const getApplicationFileCount = async (path: string) => {
  return runTelemetryOperation('applicationFiles', async () =>
    getApplicationFilesCountUncached(path)
  );
};
