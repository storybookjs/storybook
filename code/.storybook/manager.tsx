import { startCase } from 'es-toolkit/compat';
import { type State, addons } from 'storybook/manager-api';

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }) => (type === 'story' ? name : startCase(name)),
  },
  layoutCustomisations: {
    showSidebar(state: State, defaultValue: boolean) {
      if (state.viewMode === 'story' && state.storyId.startsWith('😀')) {
        return false;
      }

      return defaultValue;
    },
    showToolbar(state: State, defaultValue: boolean) {
      if (state.viewMode === 'docs') {
        return false;
      }

      return defaultValue;
    },
  },
});
