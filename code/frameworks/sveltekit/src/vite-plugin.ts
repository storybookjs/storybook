import { mockSveltekitStores } from './plugins/mock-sveltekit-stores';

export const storybookSveltekitPlugin = () => {
  return [mockSveltekitStores()];
};
