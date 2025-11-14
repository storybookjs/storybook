import React, { useEffect, useMemo } from 'react';

import {
  Card,
  Listbox,
  ListboxAction,
  ListboxButton,
  ListboxItem,
  ListboxText,
} from 'storybook/internal/components';

import { StatusFailIcon } from '@storybook/icons';

import { checklistStore, universalChecklistStore } from '#manager-stores';
import { type TransitionMapOptions, useTransitionMap } from 'react-transition-state';
import { experimental_useUniversalStore, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { checklistData } from '../../settings/Checklist/checklistData';

const useTransitionArray = <K,>(array: K[], subset: K[], options: TransitionMapOptions<K>) => {
  const { setItem, toggle, stateMap } = useTransitionMap<K>({
    allowMultiple: true,
    mountOnEnter: true,
    unmountOnExit: true,
    preEnter: true,
    ...options,
  });

  useEffect(() => {
    array.forEach((task) => setItem(task));
  }, [array, setItem]);

  useEffect(() => {
    array.forEach((task) => toggle(task, subset.includes(task)));
  }, [array, subset, toggle]);

  return Array.from(stateMap);
};

const ItemIcon = styled(StatusFailIcon)(({ theme }) => ({
  color: theme.color.mediumdark,
}));

export const ChecklistModule = () => {
  const api = useStorybookApi();
  const [{ completed, skipped }] = experimental_useUniversalStore(universalChecklistStore);

  const allTasks = useMemo(() => checklistData.sections.flatMap(({ items }) => items), []);
  const nextTasks = useMemo(
    () => allTasks.filter(({ id }) => !completed.includes(id) && !skipped.includes(id)).slice(0, 3),
    [allTasks, completed, skipped]
  );

  const transitionItems = useTransitionArray(allTasks, nextTasks, { timeout: 300 });

  if (nextTasks.length === 0) {
    return null;
  }

  return (
    <Card outlineAnimation="rainbow">
      <Listbox>
        <ListboxItem>
          <ListboxText>
            <strong>Project setup</strong>
          </ListboxText>
          <ListboxButton onClick={() => api.navigateUrl('/settings/guided-tour', { plain: false })}>
            {Math.round(((allTasks.length - nextTasks.length) / allTasks.length) * 100)}%
          </ListboxButton>
        </ListboxItem>
      </Listbox>
      <Listbox>
        {transitionItems.map(
          ([task, { status, isMounted }]) =>
            isMounted && (
              <ListboxItem key={task.id} transitionStatus={status}>
                <ListboxAction
                  onClick={() =>
                    api.navigateUrl(`/settings/guided-tour#${task.id}`, { plain: false })
                  }
                >
                  <ItemIcon />
                  {task.label}
                </ListboxAction>
                {task.start && (
                  <ListboxButton
                    onClick={() => {
                      checklistStore.complete(task.id);
                      task.start?.({ api });
                    }}
                  >
                    Start
                  </ListboxButton>
                )}
              </ListboxItem>
            )
        )}
      </Listbox>
    </Card>
  );
};
