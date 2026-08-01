import { execCommandCountLines } from './exec-command-count-lines.ts';
import { runTelemetryOperation } from './run-telemetry-operation.ts';

export const getPortableStoriesFileCountUncached = async (
  path?: string
): Promise<number | undefined> => {
  try {
    return await execCommandCountLines('git', [
      'grep',
      '-l',
      'composeStor',
      ...(path ? ['--', path] : []),
    ]);
  } catch (err: any) {
    // exit code 1 if no matches are found
    return err.exitCode === 1 ? 0 : undefined;
  }
};

export const getPortableStoriesFileCount = async (path?: string): Promise<number | undefined> => {
  return runTelemetryOperation('portableStories', async () =>
    getPortableStoriesFileCountUncached(path)
  );
};
