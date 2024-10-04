import { templateCompilation } from './plugins/vue-template';

export const storybookVuePlugin = () => {
  return [templateCompilation()];
};
