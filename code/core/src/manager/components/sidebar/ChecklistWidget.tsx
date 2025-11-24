import React, { useEffect, useRef, useState } from 'react';

import {
  ActionsList,
  Card,
  Collapsible,
  PopoverProvider,
  ProgressSpinner,
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
  const { setItem, toggle, stateMap } = useTransitionMap<K>({
    allowMultiple: true,
    mountOnEnter: true,
    unmountOnExit: true,
    preEnter: true,
    ...options,
  });

  useEffect(() => {
    const keyFn = keyFnRef.current;
    array.forEach((task) => setItem(keyFn(task)));
  }, [array, setItem]);

  useEffect(() => {
    const keyFn = keyFnRef.current;
    array.forEach((task) => toggle(keyFn(task), subset.map(keyFn).includes(keyFn(task))));
  }, [array, subset, toggle]);

  return Array.from(stateMap).map(
    ([key, value]) => [array.find((item) => keyFnRef.current(item) === key)!, value] as const
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

const CollapseToggle = styled(ActionsList.Button)({
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
    case progress < 50:
      return 'Get started';
    case progress < 75:
      return 'Level up';
    default:
      return 'Become an expert';
  }
};

const OpenGuideAction = ({
  children,
  afterClick,
}: {
  children?: React.ReactNode;
  afterClick?: () => void;
}) => {
  const api = useStorybookApi();
  return (
    <ActionsList.Action
      ariaLabel="Open onboarding guide"
      onClick={(e) => {
        e.stopPropagation();
        api.navigate('/settings/guide');
        afterClick?.();
      }}
    >
      <ActionsList.Icon>
        <ListUnorderedIcon />
      </ActionsList.Icon>
      {children}
    </ActionsList.Action>
  );
};

export const ChecklistWidget = () => {
  const api = useStorybookApi();
  const { loaded, allItems, nextItems, progress, accept, mute, items } = useChecklist();
  const [renderItems, setItems] = useState<ChecklistItem[]>([]);

  const hasItems = renderItems.length > 0;
  const transitionItems = useTransitionArray(allItems, renderItems, {
    keyFn: (item) => item.id,
    timeout: 300,
  });

  useEffect(() => {
    // Render old items (with updated status) for 2 seconds before
    // rendering new items, in order to allow exit transition.
    setItems((current) =>
      current.map((item) => ({
        ...item,
        isCompleted: items[item.id].status === 'accepted' || items[item.id].status === 'done',
        isSkipped: items[item.id].status === 'skipped',
      }))
    );
    const timeout = setTimeout(setItems, 2000, nextItems);
    return () => clearTimeout(timeout);
  }, [nextItems, items]);

  return (
    <CollapsibleWithMargin collapsed={!hasItems || !loaded}>
      <HoverCard id="storybook-checklist-widget" outlineAnimation="rainbow">
        <Collapsible
          collapsed={!hasItems}
          disabled={!hasItems}
          summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
            <ActionsList as="div" onClick={toggleCollapsed}>
              <ActionsList.Item as="div">
                <ActionsList.Item as="div" style={{ flexShrink: 1 }}>
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
                </ActionsList.Item>
                <ActionsList.Item as="div">
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
                  {loaded && (
                    <PopoverProvider
                      padding={0}
                      popover={({ onHide }) => (
                        <ActionsList>
                          <ActionsList.Item>
                            <OpenGuideAction afterClick={onHide}>
                              <ActionsList.Text>Open full guide</ActionsList.Text>
                            </OpenGuideAction>
                          </ActionsList.Item>
                          <ActionsList.Item>
                            <ActionsList.Action
                              ariaLabel={false}
                              onClick={(e) => {
                                e.stopPropagation();
                                mute(allItems.map(({ id }) => id));
                                onHide();
                              }}
                            >
                              <ActionsList.Icon>
                                <EyeCloseIcon />
                              </ActionsList.Icon>
                              <ActionsList.Text>Remove from sidebar</ActionsList.Text>
                            </ActionsList.Action>
                          </ActionsList.Item>
                        </ActionsList>
                      )}
                    >
                      <ActionsList.Button
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
                      </ActionsList.Button>
                    </PopoverProvider>
                  )}
                </ActionsList.Item>
              </ActionsList.Item>
            </ActionsList>
          )}
        >
          <ActionsList>
            {transitionItems.map(
              ([item, { status, isMounted }]) =>
                isMounted && (
                  <ActionsList.HoverItem key={item.id} targetId={item.id} transitionStatus={status}>
                    <ActionsList.Action
                      ariaLabel={`Open onboarding guide for ${item.label}`}
                      onClick={() => api.navigate(`/settings/guide#${item.id}`)}
                    >
                      <ActionsList.Icon>
                        {item.isCompleted ? (
                          <Particles anchor={Checked} key={item.id} />
                        ) : (
                          <StatusFailIcon />
                        )}
                      </ActionsList.Icon>
                      <ActionsList.Text>
                        <ItemLabel isCompleted={item.isCompleted} isSkipped={item.isSkipped}>
                          {item.label}
                        </ItemLabel>
                      </ActionsList.Text>
                    </ActionsList.Action>
                    {item.action && (
                      <ActionsList.Button
                        data-target-id={item.id}
                        ariaLabel={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          item.action?.onClick({
                            api,
                            accept: () => accept(item.id),
                          });
                        }}
                      >
                        {item.action.label}
                      </ActionsList.Button>
                    )}
                  </ActionsList.HoverItem>
                )
            )}
          </ActionsList>
        </Collapsible>
      </HoverCard>
    </CollapsibleWithMargin>
  );
};
