import type { FC } from 'react';
import React, { useMemo, useState } from 'react';

import { useChannel, useStorybookApi, useStorybookState } from 'storybook/internal/manager-api';
import { Addon_TypesEnum } from 'storybook/internal/types';

import { STORY_PREPARED } from '../../core-events';
import { AddonPanel } from '../components/panel/Panel';

const Panel: FC<any> = (props) => {
  const api = useStorybookApi();
  const state = useStorybookState();
  const [story, setStory] = useState(api.getCurrentStoryData());

  useChannel(
    {
      [STORY_PREPARED]: () => {
        setStory(api.getCurrentStoryData());
      },
    },
    []
  );

  const { parameters, type } = story ?? {};

  const panelActions = useMemo(
    () => ({
      onSelect: (panel: string) => api.setSelectedPanel(panel),
      toggleVisibility: () => api.togglePanel(),
      togglePosition: () => api.togglePanelPosition(),
    }),
    [api]
  );

  const panels = useMemo(() => {
    const allPanels = api.getElements(Addon_TypesEnum.PANEL);

    if (!allPanels || type !== 'story') {
      return allPanels;
    }

    const filteredPanels: typeof allPanels = {};
    Object.entries(allPanels).forEach(([id, p]) => {
      const { paramKey }: any = p;
      if (paramKey && parameters && parameters[paramKey] && parameters[paramKey].disable) {
        return;
      }
      if (p.disabled === true || (typeof p.disabled === 'function' && p.disabled(parameters))) {
        return;
      }
      filteredPanels[id] = p;
    });

    return filteredPanels;
  }, [api, type, parameters]);

  return (
    <AddonPanel
      panels={panels}
      selectedPanel={api.getSelectedPanel()}
      panelPosition={state.layout.panelPosition}
      actions={panelActions}
      shortcuts={api.getShortcutKeys()}
      {...props}
    />
  );
};

export default Panel;
