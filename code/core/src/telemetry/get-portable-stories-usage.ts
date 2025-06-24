import { execCommandCountLines } from './exec-command-count-lines';
import { runTelemetryOperation } from './run-telemetry-operation';

export const getPortableStoriesFileCountUncached = async (path?: string) => {
  try {
    const command = `git grep -l composeStor` + (path ? ` -- ${path}` : '');
    return await execCommandCountLines(command);
  } catch (err: any) {
    // exit code 1 if no matches are found
    return err.exitCode === 1 ? 0 : undefined;
  }
};

export const getPortableStoriesFileCount = async (path?: string) => {
  return runTelemetryOperation('portableStories', async () =>
    getPortableStoriesFileCountUncached(path)
  );
};
