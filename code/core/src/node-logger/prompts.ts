// Import everything to create the unified prompt object
import { clearTrackedLogs, getTrackedLogs, writeLogsToFile } from './log-tracker';
import { debug, error, getLogLevel, intro, log, logBox, setLogLevel, warn } from './logger';
import { confirm, multiselect, select, spinner, taskLog, text } from './prompt-functions';
import { executeTask, executeTaskWithSpinner } from './tasks';

// Maintain the existing prompt object API for backward compatibility
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
