// Import everything to create the unified prompt object
import { clearTrackedLogs, getTrackedLogs, writeLogsToFile } from './log-tracker';
import { debug, error, getLogLevel, intro, log, logBox, setLogLevel, warn } from './logger';
import { confirm, multiselect, select, spinner, taskLog, text } from './prompt-functions-prompts';
import { executeTask, executeTaskWithSpinner } from './tasks';

export const prompt = {
  spinner,
  confirm,
  intro,
  text,
  select,
  multiselect,
  logBox,
  log,
  warn,
  error,
  debug,
  taskLog,
  executeTask,
  executeTaskWithSpinner,
  writeLogsToFile,
  getTrackedLogs,
  clearTrackedLogs,
  setLogLevel,
  getLogLevel,
};
