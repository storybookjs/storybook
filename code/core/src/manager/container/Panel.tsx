import type { FC } from 'react';
import React from 'react';

import { Addon_TypesEnum } from '@storybook/core/types';

import { Consumer } from '@storybook/core/manager-api';
import type { API, Combo } from '@storybook/core/manager-api';

import memoize from 'memoizerific';

import { AddonPanel } from '../components/panel/Panel';

const createPanelActions = memoize(1)((api) => ({
  onSelect: (panel: string) => api.setSelectedPanel(panel),
  toggleVisibility: () => api.togglePanel(),
  togglePosition: () => api.togglePanelPosition(),
}));

const getPanels = (api: API) => {
  const allPanels = api.getElements(Addon_TypesEnum.PANEL);
  const story = api.getCurrentStoryData();

  if (!allPanels || !story || story.type !== 'story') {
    return allPanels;
  }

  const { parameters } = story;

  const filteredPanels: typeof allPanels = {};
  Object.entries(allPanels).forEach(([id, panel]) => {
    const { paramKey }: any = panel;
    if (paramKey && parameters && parameters[paramKey] && parameters[paramKey].disable) {
      return;
    }
    filteredPanels[id] = panel;
  });

  return filteredPanels;
};

const mapper = ({ state, api }: Combo) => ({
  panels: getPanels(api),
  selectedPanel: api.getSelectedPanel(),
  panelPosition: state.layout.panelPosition,
  actions: createPanelActions(api),
  shortcuts: api.getShortcutKeys(),
});

const Panel: FC<any> = (props) => (
  <Consumer filter={mapper}>{(customProps) => <AddonPanel {...props} {...customProps} />}</Consumer>
);

export default Panel;
