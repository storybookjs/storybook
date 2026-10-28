import { framework, projectAddon } from '../../plugins.ts';

export default {
  framework: framework(),
  stories: ['../*.stories.ts'],
  addons: [projectAddon({ name: 'alpha' })],
};
