import React, { useEffect, useRef, useState } from 'react';

import {
  Card,
  Collapsible,
  Listbox,
  ListboxAction,
  ListboxButton,
  ListboxHoverItem,
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
  StatusPassIcon,
} from '@storybook/icons';

import { type TransitionMapOptions, useTransitionMap } from 'react-transition-state';
import { useStorybookApi } from 'storybook/manager-api';
import { keyframes, styled } from 'storybook/theming';

import { Optional } from '../Optional/Optional';
import { Particles } from '../Particles/Particles';
import { TextFlip } from '../TextFlip';
import type { ChecklistItem } from './useChecklist';
import { useChecklist } from './useChecklist';

const fadeScaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.7);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const expand = keyframes`
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
`;

const useTransitionArray = <K, V>(
  array: V[],
  subset: V[],
  options: { keyFn: (item: V) => K } & TransitionMapOptions<K>
) => {
  const keyFnRef = useRef(options.keyFn);
  const { deleteItem, setItem, toggle, stateMap } = useTransitionMap<K>({
    allowMultiple: true,
    mountOnEnter: true,
    unmountOnExit: true,
    preEnter: true,
    ...options,
  });

  useEffect(() => {
    const keyFn = keyFnRef.current;
    array.forEach((task) => setItem(keyFn(task)));
    return () => array.forEach((task) => deleteItem(keyFn(task)));
  }, [array, deleteItem, setItem, keyFnRef]);

  useEffect(() => {
    const keyFn = keyFnRef.current;
    array.forEach((task) => toggle(keyFn(task), subset.map(keyFn).includes(keyFn(task))));
  }, [array, subset, toggle, keyFnRef]);

  return Array.from(stateMap).map(
    ([key, value]) => [array.find((item) => options.keyFn(item) === key)!, value] as const
  );
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

const Checked = styled(StatusPassIcon)(({ theme }) => ({
  padding: 1,
  borderRadius: '50%',
  background: theme.color.positive,
  color: theme.background.content,
  animation: `${fadeScaleIn} 500ms forwards`,
}));

const ItemLabel = styled.span<{ isCompleted: boolean; isSkipped: boolean }>(
  ({ theme, isCompleted, isSkipped }) => ({
    position: 'relative',
    margin: '0 -2px',
    padding: '0 2px',
    color: isSkipped
      ? theme.color.mediumdark
      : isCompleted
        ? theme.base === 'dark'
          ? theme.color.positive
          : theme.color.positiveText
        : theme.color.defaultText,
    transition: 'color 500ms',
  }),
  ({ theme, isSkipped }) =>
    isSkipped && {
      '&:after': {
        content: '""',
        position: 'absolute',
        top: '50%',
        left: 0,
        width: '100%',
        height: 1,
        background: theme.color.mediumdark,
        animation: `${expand} 500ms forwards`,
        transformOrigin: 'left',
      },
    }
);

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
      ariaLabel="Open onboarding guide"
      onClick={(e) => {
        e.stopPropagation();
        api.navigate('/settings/guide');
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
  const { loaded, accepted, done, skipped, allItems, nextItems, progress, accept, mute } =
    useChecklist();

  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    setItems((current) => {
      current.forEach((item) => {
        item.isCompleted = accepted.includes(item.id) || done.includes(item.id);
        item.isSkipped = skipped.includes(item.id);
      });
      return current;
    });
    const timeout = setTimeout(setItems, 2000, nextItems);
    return () => clearTimeout(timeout);
  }, [accepted, done, skipped, nextItems]);

  const transitionItems = useTransitionArray(allItems, items, {
    keyFn: (item) => item.id,
    timeout: 300,
  });
  const hasItems = items.length > 0;

  return (
    <CollapsibleWithMargin collapsed={!hasItems}>
      <HoverCard outlineAnimation="rainbow">
        <Collapsible
          collapsed={!hasItems}
          disabled={!hasItems}
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
                      ariaLabel={`${isCollapsed ? 'Expand' : 'Collapse'} onboarding checklist`}
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
                              ariaLabel={false}
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
                      <ListboxButton
                        ariaLabel={`${progress}% completed`}
                        onClick={(e) => e.stopPropagation()}
                      >
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
                  <ListboxHoverItem
                    as="li"
                    key={item.id}
                    targetId={item.id}
                    transitionStatus={status}
                  >
                    <ListboxAction
                      ariaLabel={`Open onboarding guide for ${item.label}`}
                      onClick={() => api.navigate(`/settings/guide#${item.id}`)}
                    >
                      <ListboxIcon>
                        {item.isCompleted ? (
                          <Particles anchor={Checked} key={item.id} />
                        ) : (
                          <StatusFailIcon />
                        )}
                      </ListboxIcon>
                      <ListboxText>
                        <ItemLabel isCompleted={item.isCompleted} isSkipped={item.isSkipped}>
                          {item.label}
                        </ItemLabel>
                      </ListboxText>
                    </ListboxAction>
                    {item.action && (
                      <ListboxButton
                        data-target-id={item.id}
                        ariaLabel={false}
                        onClick={() => {
                          item.action?.onClick({
                            api,
                            accept: () => accept(item.id),
                          });
                        }}
                      >
                        {item.action.label}
                      </ListboxButton>
                    )}
                  </ListboxHoverItem>
                )
            )}
          </Listbox>
        </Collapsible>
      </HoverCard>
    </CollapsibleWithMargin>
  );
};
