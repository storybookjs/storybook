import { SbMain } from './main';
import type { UserOptions } from './types';

export function storybookPlugin(options?: UserOptions) {
  return [SbMain(options)];
}
