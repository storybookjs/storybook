import type { Plugin } from 'vite';

import { templateCompilation } from './plugins/vue-template.ts';

export const storybookVuePlugin = (): Promise<Plugin>[] => {
  return [templateCompilation()];
};
