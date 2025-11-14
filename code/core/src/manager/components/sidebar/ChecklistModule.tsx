import React, { useEffect } from 'react';

import {
  Card,
  Collapsible,
  Listbox,
  ListboxAction,
  ListboxButton,
  ListboxIcon,
  ListboxItem,
  ListboxText,
  ProgressSpinner,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';

import {
  ChevronSmallUpIcon,
  EyeCloseIcon,
  ListUnorderedIcon,
  StatusFailIcon,
} from '@storybook/icons';

import { checklistStore } from '#manager-stores';
import { type TransitionMapOptions, useTransitionMap } from 'react-transition-state';
import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { TextFlip } from '../TextFlip';
import { useChecklist } from './useChecklist';

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

const CollapsibleWithMargin = styled(Collapsible)(({ collapsed }) => ({
  marginTop: collapsed ? 0 : 16,
}));

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

const ProgressCircle = styled(ProgressSpinner)(({ theme }) => ({
  color: theme.color.secondary,
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
  const { loaded, allItems, nextItems, progress, mute } = useChecklist();

  const transitionItems = useTransitionArray(allItems, nextItems, { timeout: 300 });
  const hasItems = nextItems.length > 0;

  return (
    <CollapsibleWithMargin collapsed={!hasItems}>
      <HoverCard outlineAnimation="rainbow">
        <Collapsible
          collapsed={!hasItems}
          disabled={!hasItems}
          summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
            <Listbox onClick={toggleCollapsed}>
              <ListboxItem>
                <ListboxItem>
                  {loaded && (
                    <ListboxAction
                      onClick={(e) => {
                        e.stopPropagation();
                        api.navigateUrl('/settings/guide', { plain: false });
                      }}
                    >
                      <strong>{title(progress)}</strong>
                    </ListboxAction>
                  )}
                </ListboxItem>
                <ListboxItem>
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
                  {loaded && (
                    <WithTooltip
                      as="div"
                      closeOnOutsideClick
                      tooltip={({ onHide }) => (
                        <Listbox as="ul">
                          <ListboxItem as="li">
                            <ListboxAction
                              onClick={(e) => {
                                e.stopPropagation();
                                api.navigateUrl('/settings/guide', { plain: false });
                                onHide();
                              }}
                            >
                              <ListboxIcon>
                                <ListUnorderedIcon />
                              </ListboxIcon>
                              <ListboxText>Open full guide</ListboxText>
                            </ListboxAction>
                          </ListboxItem>
                          <ListboxItem as="li">
                            <ListboxAction
                              onClick={(e) => {
                                e.stopPropagation();
                                mute(allItems.map(({ id }) => id));
                                onHide();
                              }}
                            >
                              <ListboxIcon>
                                <EyeCloseIcon />
                              </ListboxIcon>
                              <ListboxText>Remove from sidebar</ListboxText>
                            </ListboxAction>
                          </ListboxItem>
                        </Listbox>
                      )}
                    >
                      <ListboxButton onClick={(e) => e.stopPropagation()}>
                        <ProgressCircle
                          percentage={progress}
                          running={false}
                          size={16}
                          width={1.5}
                        />
                        <TextFlip text={`${progress}%`} placeholder="00%" />
                      </ListboxButton>
                    </WithTooltip>
                  )}
                </ListboxItem>
              </ListboxItem>
            </Listbox>
          )}
        >
          <Listbox as="ul">
            {transitionItems.map(
              ([item, { status, isMounted }]) =>
                isMounted && (
                  <ListboxItem as="li" key={item.id} transitionStatus={status}>
                    <ListboxAction
                      onClick={() =>
                        api.navigateUrl(`/settings/guide#${item.id}`, { plain: false })
                      }
                    >
                      <ListboxIcon>
                        <StatusFailIcon />
                      </ListboxIcon>
                      <ListboxText>{item.label}</ListboxText>
                    </ListboxAction>
                    {item.action && (
                      <ListboxButton
                        onClick={() => {
                          item.action?.onClick({
                            api,
                            accept: () => checklistStore.accept(item.id),
                          });
                        }}
                      >
                        {item.action.label}
                      </ListboxButton>
                    )}
                  </ListboxItem>
                )
            )}
          </Listbox>
        </Collapsible>
      </HoverCard>
    </CollapsibleWithMargin>
  );
};
