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

const title = (progress: number) => {
  switch (true) {
    case progress < 25:
      return 'Getting started';
    case progress < 50:
      return 'Making progress';
    case progress < 75:
      return 'Getting close';
    default:
      return 'Almost there';
  }
};

export const ChecklistModule = () => {
  const api = useStorybookApi();
  const [{ completed, skipped }] = experimental_useUniversalStore(universalChecklistStore);

  const totalCount = checklistData.sections.reduce((acc, { items }) => acc + items.length, 0);
  const doneCount = checklistData.sections.reduce(
    (acc, { items }) =>
      acc + items.filter(({ id }) => completed.includes(id) || skipped.includes(id)).length,
    0
  );
  const progress = Math.round((doneCount / totalCount) * 100);

  const nextTasks = checklistData.sections
    .map(({ items }) =>
      items.find(
        ({ id, after }) =>
          !completed.includes(id) &&
          !skipped.includes(id) &&
          !after?.some((id) => !completed.includes(id))
      )
    )
    .flatMap((item) => (item ? [{ ...item, nodeRef: createRef<HTMLLIElement>() }] : []));

  if (nextTasks.length === 0) {
    return null;
  }

  return (
    <Card outlineAnimation="rainbow">
      <Listbox>
        <ListboxItem>
          <ListboxText>
            <strong>{title(progress)}</strong>
          </ListboxText>
          <ListboxButton onClick={() => api.navigateUrl('/settings/guide', { plain: false })}>
            {progress}%
          </ListboxButton>
        </ListboxItem>
      </Listbox>
      <TransitionGroup component={Listbox}>
        {nextTasks.map((task) => (
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
