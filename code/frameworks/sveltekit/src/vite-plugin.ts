import { mockSveltekitStores } from './plugins/mock-sveltekit-stores.ts';

export const storybookSveltekitPlugin = () => {
  return [mockSveltekitStores()];
};
