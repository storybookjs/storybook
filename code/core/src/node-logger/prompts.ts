// Import everything to create the unified prompt object
import { clearTrackedLogs, getTrackedLogs, writeLogsToFile } from './log-tracker';
import { debug, error, getLogLevel, intro, log, logBox, outro, setLogLevel, warn } from './logger';
import * as clackFunctions from './prompt-functions';
import * as promptFunctions from './prompt-functions-prompts';
import { executeTask, executeTaskWithSpinner } from './tasks';

const USE_CLACK = process.env.USE_CLACK === 'false' ? false : true;
const functions = USE_CLACK ? clackFunctions : promptFunctions;

export const prompt = {
  ...functions,
  intro,
  outro,
  logBox,
  log,
  warn,
  error,
  debug,
  executeTask,
  executeTaskWithSpinner,
  writeLogsToFile,
  getTrackedLogs,
  clearTrackedLogs,
  setLogLevel,
  getLogLevel,
};
