import { framework, projectAddon } from '../../addons.ts';

export default {
  framework: framework(),
  stories: ['../*.stories.ts'],
  addons: [projectAddon({ name: 'alpha' })],
};
