import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { STORY_CHANGED } from 'storybook/internal/core-events';

import { dequal as deepEqual } from 'dequal';
import type { API } from 'storybook/manager-api';
import { useParameter } from 'storybook/manager-api';

import { ActionLogger as ActionLoggerComponent } from '../../components/ActionLogger';
import { CLEAR_ID, EVENT_ID, PARAM_KEY } from '../../constants';
import type { ActionDisplay } from '../../models';
import type { ActionsParameters } from '../../types';

interface ActionLoggerProps {
  active: boolean;
  api: API;
}

const safeDeepEqual = (a: any, b: any): boolean => {
  try {
    return deepEqual(a, b);
  } catch (e) {
    return false;
  }
};

export default function ActionLogger({ active, api }: ActionLoggerProps) {
  const [actions, setActions] = useState<ActionDisplay[]>([]);
  const parameter = useParameter<ActionsParameters['actions']>(PARAM_KEY);
  const expandLevel = parameter?.expandLevel ?? 1;

  const clearActions = useCallback(() => {
    api.emit(CLEAR_ID);
    setActions([]);
  }, [api]);

  const addAction = useCallback((action: ActionDisplay) => {
    setActions((prevActions) => {
      const previous = prevActions.length > 0 ? prevActions[prevActions.length - 1] : null;
      const rawLimit = action.options.limit;
      const limit = Number.isFinite(rawLimit) ? Math.max(0, Math.trunc(rawLimit)) : 0;

      if (limit <= 0) {
        return [];
      }

      if (previous && safeDeepEqual(previous.data, action.data)) {
        const updatedActions = [...prevActions];
        updatedActions[updatedActions.length - 1] = {
          ...previous,
          count: previous.count + 1,
        };
        return updatedActions.slice(-limit);
      }

      const nextAction = { ...action, count: 1 };
      return [...prevActions, nextAction].slice(-limit);
    });
  }, []);

  const handleStoryChange = useCallback(() => {
    if (actions.length > 0 && actions[0].options.clearOnStoryChange) {
      clearActions();
    }
  }, [actions, clearActions]);

  useEffect(() => {
    api.on(EVENT_ID, addAction);
    api.on(STORY_CHANGED, handleStoryChange);

    return () => {
      api.off(EVENT_ID, addAction);
      api.off(STORY_CHANGED, handleStoryChange);
    };
  }, [api, addAction, handleStoryChange]);

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
