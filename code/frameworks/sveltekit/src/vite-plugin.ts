import { mockSveltekitModules } from './plugins/mock-sveltekit-modules.ts';

export const storybookSveltekitPlugin = () => {
  return [mockSveltekitModules()];
};
