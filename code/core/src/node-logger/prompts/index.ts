import { executeTask, executeTaskWithSpinner } from '../tasks.ts';
import * as promptConfig from './prompt-config.ts';
import * as promptFunctions from './prompt-functions.ts';

export const prompt = {
  ...promptFunctions,
  ...promptConfig,
  executeTask,
  executeTaskWithSpinner,
};
