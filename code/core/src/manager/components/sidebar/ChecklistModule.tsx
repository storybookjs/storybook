import React, { createRef, useMemo } from 'react';

import {
  Card,
  Collapsible,
  Listbox,
  ListboxAction,
  ListboxButton,
  ListboxIcon,
  ListboxItem,
  ListboxText,
  Optional,
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
import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { TextFlip } from '../TextFlip';
import { Transition, TransitionGroup } from '../Transition';
import { useChecklist } from './useChecklist';

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

const OpenGuideAction = ({ children }: { children?: React.ReactNode }) => {
  const api = useStorybookApi();
  return (
    <ListboxAction
      onClick={(e) => {
        e.stopPropagation();
        api.navigateUrl('/settings/guide', { plain: false });
      }}
    >
      <ListboxIcon>
        <ListUnorderedIcon />
      </ListboxIcon>
      {children}
    </ListboxAction>
  );
};

export const ChecklistModule = () => {
  const api = useStorybookApi();
  const { loaded, allItems, nextItems, progress, mute } = useChecklist();

  const next = useMemo(
    () => nextItems.map((item) => ({ ...item, nodeRef: createRef<HTMLDivElement>() })),
    [nextItems]
  );
  const hasTasks = next.length > 0;

  return (
    <CollapsibleWithMargin collapsed={!hasTasks}>
      <HoverCard outlineAnimation="rainbow">
        <Collapsible
          collapsed={!hasTasks}
          disabled={!hasTasks}
          summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
            <Listbox onClick={toggleCollapsed}>
              <ListboxItem>
                <ListboxItem style={{ flexShrink: 1 }}>
                  {loaded && (
                    <Optional
                      content={
                        <OpenGuideAction>
                          <strong>{title(progress)}</strong>
                        </OpenGuideAction>
                      }
                      fallback={<OpenGuideAction />}
                    />
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
                            <OpenGuideAction>
                              <ListboxText>Open full guide</ListboxText>
                            </OpenGuideAction>
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
          <TransitionGroup as="ul" component={Listbox}>
            {next.map((item) => (
              <Transition key={item.id} nodeRef={item.nodeRef} timeout={300}>
                <ListboxItem as="li" ref={item.nodeRef}>
                  <ListboxAction
                    onClick={() => api.navigateUrl(`/settings/guide#${item.id}`, { plain: false })}
                  >
                    <ListboxIcon>
                      <StatusFailIcon />
                    </ListboxIcon>
                    <ListboxText>
                      <span>{item.label}</span>
                    </ListboxText>
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
              </Transition>
            ))}
          </TransitionGroup>
        </Collapsible>
      </HoverCard>
    </CollapsibleWithMargin>
  );
};
