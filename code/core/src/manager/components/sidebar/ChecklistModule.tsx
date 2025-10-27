import React, { createRef, useMemo } from 'react';

import {
  Card,
  Collapsible,
  Listbox,
  ListboxAction,
  ListboxButton,
  ListboxItem,
  ListboxText,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';

import { ChevronSmallUpIcon, StatusFailIcon } from '@storybook/icons';

import { checklistStore, universalChecklistStore } from '#manager-stores';
import { experimental_useUniversalStore, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { checklistData } from '../../settings/Checklist/checklistData';
import { Transition, TransitionGroup } from '../Transition';

type ChecklistItem = (typeof checklistData)['sections'][number]['items'][number];

const HoverCard = styled(Card)({
  '&:hover #checklist-module-collapse-toggle': {
    opacity: 1,
  },
});

const CollapseToggle = styled(ListboxButton)({
  opacity: 0,
  transition: 'opacity var(--transition-duration, 0.2s)',
  '&:focus, &:hover': {
    opacity: 1,
  },
});

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
    const isReady = ({ id, after }: ChecklistItem): boolean =>
      !completed.includes(id) &&
      !skipped.includes(id) &&
      !(Array.isArray(muted) && muted.includes(id)) &&
      !after?.some((id) => !completed.includes(id));

    // Collect a list of the next 3 tasks that are ready.
    // Tasks are pulled from each section in a round-robin fashion,
    // so that users can choose their own adventure.
    return checklistData.sections
      .flatMap(({ items }, sectionIndex) =>
        items.filter(isReady).map((item, itemIndex) => ({ item, itemIndex, sectionIndex }))
      )
      .sort((a, b) => a.itemIndex - b.itemIndex)
      .slice(0, 3)
      .sort((a, b) => a.sectionIndex - b.sectionIndex)
      .flatMap(({ item }) => (item ? [{ ...item, nodeRef: createRef<HTMLLIElement>() }] : []));
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
    <HoverCard outlineAnimation="rainbow">
      <Collapsible
        summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
          <Listbox onClick={toggleCollapsed}>
            <ListboxItem>
              <ListboxText>
                <strong>{title(progress)}</strong>
              </ListboxText>
              <WithTooltip
                hasChrome={false}
                tooltip={
                  <TooltipNote
                    note={`${isCollapsed ? 'Expand' : 'Collapse'} onboarding checklist`}
                  />
                }
                trigger="hover"
              >
                <CollapseToggle
                  {...toggleProps}
                  id="checklist-module-collapse-toggle"
                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} onboarding checklist`}
                >
                  <ChevronSmallUpIcon
                    style={{
                      transform: isCollapsed ? 'rotate(180deg)' : 'none',
                      transition: 'transform 250ms',
                      willChange: 'auto',
                    }}
                  />
                </CollapseToggle>
              </WithTooltip>
              <ListboxButton
                onClick={(e) => {
                  e.stopPropagation();
                  api.navigateUrl('/settings/guide', { plain: false });
                }}
              >
                {progress}%
              </ListboxButton>
            </ListboxItem>
          </Listbox>
        )}
      >
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
      </Collapsible>
    </HoverCard>
  );
};
