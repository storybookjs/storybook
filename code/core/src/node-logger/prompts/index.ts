import { executeTask, executeTaskWithSpinner } from '../tasks';
import * as promptConfig from './prompt-config';
import * as promptFunctions from './prompt-functions';

export const prompt = {
  ...promptFunctions,
  ...promptConfig,
  executeTask,
  executeTaskWithSpinner,
};
