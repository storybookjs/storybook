import React, { createRef, useMemo } from 'react';

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
  const [{ muted, completed, skipped }] = experimental_useUniversalStore(universalChecklistStore);

  const nextTasks = useMemo(() => {
    if (muted === true) {
      return [];
    }
    return checklistData.sections
      .map(({ items }) =>
        items.find(
          ({ id, after }) =>
            !completed.includes(id) &&
            !skipped.includes(id) &&
            !(Array.isArray(muted) && muted.includes(id)) &&
            !after?.some((id) => !completed.includes(id))
        )
      )
      .flatMap((item) => (item ? [{ ...item, nodeRef: createRef<HTMLLIElement>() }] : []));
  }, [muted, completed, skipped]);

  if (nextTasks.length === 0) {
    return null;
  }

  const totalCount = checklistData.sections.reduce((acc, { items }) => acc + items.length, 0);
  const doneCount = checklistData.sections.reduce(
    (acc, { items }) =>
      acc + items.filter(({ id }) => completed.includes(id) || skipped.includes(id)).length,
    0
  );
  const progress = Math.round((doneCount / totalCount) * 100);

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
              {task.action && (
                <ListboxButton
                  onClick={() => {
                    checklistStore.complete(task.id);
                    task.action?.onClick({ api });
                  }}
                >
                  {task.action.label}
                </ListboxButton>
              )}
            </ListboxItem>
          </Transition>
        ))}
      </TransitionGroup>
    </Card>
  );
};
