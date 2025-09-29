import type { Plugin } from 'vite';

import { templateCompilation } from './plugins/vue-template';

export const storybookVuePlugin = (): Promise<Plugin>[] => {
  return [templateCompilation()];
};
