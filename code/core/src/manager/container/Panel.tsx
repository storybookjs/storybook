import type { FC } from 'react';
import React, { useEffect, useMemo, useState } from 'react';

import { Addon_TypesEnum } from 'storybook/internal/types';

import { useChannel, useStorybookApi, useStorybookState } from 'storybook/manager-api';

import { STORY_PREPARED } from '../../core-events/index.ts';
import { focusableUIElements } from '../../manager-api/modules/layout.ts';
import { AddonPanel } from '../components/panel/Panel.tsx';

export interface PanelActions {
  onSelect: (panel: string) => void;
  toggleVisibility: () => void | Promise<void>;
  togglePosition?: () => void;
}

export interface PanelProps {
  /** When set, load story metadata from this id instead of the manager selection. */
  storyId?: string;
  panelPosition?: 'bottom' | 'right';
  actions?: PanelActions;
  showPanelPositionToggle?: boolean;
}

const Panel: FC<PanelProps> = ({
  storyId,
  panelPosition: panelPositionProp,
  actions,
  showPanelPositionToggle,
  ...props
}) => {
  const api = useStorybookApi();
  const state = useStorybookState();

  const resolveStory = () => (storyId ? api.getData(storyId) : api.getCurrentStoryData());

  const [story, setStory] = useState(() => resolveStory());

  useEffect(() => {
    setStory(resolveStory());
  }, [storyId, api, state.storyId, state.path]);

  useChannel(
    {
      [STORY_PREPARED]: () => {
        setStory(resolveStory());
      },
    },
    [storyId]
  );

  const { parameters, type } = story ?? {};

  const defaultActions = useMemo<PanelActions>(
    () => ({
      onSelect: (panel: string) => api.setSelectedPanel(panel),
      toggleVisibility: async () => {
        const wasPanelShown = api.getIsPanelShown();
        api.togglePanel();
        if (wasPanelShown) {
          const success = await api.focusOnUIElement(focusableUIElements.showAddonPanel);
          if (success === false) {
            document.body.focus();
          }
        }
      },
      togglePosition: () => api.togglePanelPosition(),
    }),
    [api]
  );

  const panelActions = actions ?? defaultActions;

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
      panelPosition={panelPositionProp ?? state.layout.panelPosition}
      actions={panelActions}
      shortcuts={api.getShortcutKeys()}
      showPanelPositionToggle={showPanelPositionToggle}
      {...props}
    />
  );
};

export default Panel;
