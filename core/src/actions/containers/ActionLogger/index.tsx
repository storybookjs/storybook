import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { STORY_CHANGED } from 'storybook/internal/core-events';

import { useParameter } from 'storybook/manager-api';

import { ActionLogger as ActionLoggerComponent } from '../../components/ActionLogger';
import { CLEAR_ID, EVENT_ID, PARAM_KEY } from '../../constants';
import type { ActionDisplay } from '../../models';
import type { ActionsParameters } from '../../types';

import { addAction } from './actionUtils';

interface ActionLoggerProps {
  active: boolean;
  api: any;
}

export default function ActionLogger({ active, api }: ActionLoggerProps) {
  const [actions, setActions] = useState<ActionDisplay[]>([]);
  const parameter = useParameter<ActionsParameters['actions']>(PARAM_KEY);
  const expandLevel = parameter?.expandLevel ?? 1;

  const clearActions = useCallback(() => {
    api.emit(CLEAR_ID);
    setActions([]);
  }, [api]);

  const handleAddAction = useCallback(
    (action: ActionDisplay) => {
      setActions((prevActions) => addAction(prevActions, action));
    },
    []
  );

  const handleStoryChange = useCallback(() => {
    if (actions.length > 0 && actions[0].options.clearOnStoryChange) {
      clearActions();
    }
  }, [actions, clearActions]);

  useEffect(() => {
    api.on(EVENT_ID, handleAddAction);
    api.on(STORY_CHANGED, handleStoryChange);

    return () => {
      api.off(EVENT_ID, handleAddAction);
      api.off(STORY_CHANGED, handleStoryChange);
    }
  }, [api, handleAddAction, handleStoryChange]);

  const props = useMemo(
    () => ({
      actions,
      expandLevel,
      onClear: clearActions,
    }),
    [actions, expandLevel, clearActions]
  );

  return active ? <ActionLoggerComponent {...props} /> : null;
}
