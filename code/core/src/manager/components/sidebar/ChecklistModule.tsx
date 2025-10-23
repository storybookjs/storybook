import React, { createRef } from 'react';

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
import { experimental_useUniversalStore, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { checklistData } from '../../settings/Checklist/checklistData';
import { Transition, TransitionGroup } from '../Transition';

const ItemIcon = styled(StatusFailIcon)(({ theme }) => ({
  color: theme.color.mediumdark,
}));

export const ChecklistModule = () => {
  const api = useStorybookApi();
  const [{ completed, skipped }] = experimental_useUniversalStore(universalChecklistStore);

  const allTasks = checklistData.sections.flatMap(({ items }) => items);
  const nextTasks = allTasks
    .filter(({ id }) => !completed.includes(id) && !skipped.includes(id))
    .map((task) => ({ ...task, nodeRef: createRef<HTMLLIElement>() }));

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
          <ListboxButton onClick={() => api.navigateUrl('/settings/guide', { plain: false })}>
            {Math.round(((allTasks.length - nextTasks.length) / allTasks.length) * 100)}%
          </ListboxButton>
        </ListboxItem>
      </Listbox>
      <TransitionGroup component={Listbox}>
        {nextTasks.slice(0, 3).map((task) => (
          <Transition key={task.id} nodeRef={task.nodeRef} timeout={300}>
            <ListboxItem ref={task.nodeRef}>
              <ListboxAction
                onClick={() => api.navigateUrl(`/settings/guide#${task.id}`, { plain: false })}
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
          </Transition>
        ))}
      </TransitionGroup>
    </Card>
  );
};
