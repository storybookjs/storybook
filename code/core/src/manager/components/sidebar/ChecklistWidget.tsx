import React, { useEffect, useRef, useState } from 'react';

import {
  ActionList,
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

const CollapseToggle = styled(ActionList.Button)({
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

const OpenGuideButton = ({
  children,
  afterClick,
}: {
  children?: React.ReactNode;
  afterClick?: () => void;
}) => {
  const api = useStorybookApi();
  return (
    <ActionList.Action
      ariaLabel="Open onboarding guide"
      onClick={(e) => {
        e.stopPropagation();
        api.navigate('/settings/guide');
        afterClick?.();
      }}
    >
      <ActionList.Icon>
        <ListUnorderedIcon />
      </ActionList.Icon>
      {children}
    </ActionList.Action>
  );
};

export const ChecklistWidget = () => {
  const api = useStorybookApi();
  const { loaded, ready, allItems, nextItems, progress, accept, mute, items } = useChecklist();
  const [renderItems, setRenderItems] = useState<ChecklistItem[]>(nextItems);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (ready) {
      // Don't animate anything until the checklist items have settled down.
      const timeout = setTimeout(setAnimated, 1000, true);
      return () => clearTimeout(timeout);
    }
  }, [ready]);

  useEffect(() => {
    if (!animated) {
      setRenderItems(nextItems);
      return;
    }

    // Render outgoing items with updated state for 2 seconds before
    // rendering new items, in order to allow exit transition.
    setRenderItems((current) => {
      let animateOut = false;
      const prevItems = current.map((item) => {
        const { status } = items[item.id];
        const isAccepted = status === 'accepted';
        const isDone = status === 'done';
        const isSkipped = status === 'skipped';
        animateOut = animateOut || isAccepted || isDone || isSkipped;
        return { ...item, isCompleted: isAccepted || isDone, isAccepted, isDone, isSkipped };
      });
      return animateOut ? prevItems : nextItems;
    });

    const timeout = setTimeout(setRenderItems, 2000, nextItems);
    return () => clearTimeout(timeout);
  }, [animated, nextItems, items]);

  const hasItems = renderItems.length > 0;
  const transitionItems = useTransitionArray(allItems, renderItems, {
    keyFn: (item) => item.id,
    timeout: animated ? 300 : 0,
  });

  return (
    <CollapsibleWithMargin collapsed={!hasItems || !loaded}>
      <HoverCard id="storybook-checklist-widget" outlineAnimation="rainbow">
        <Collapsible
          collapsed={!hasItems}
          disabled={!hasItems}
          summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
            <ActionList as="div" onClick={toggleCollapsed}>
              <ActionList.Item as="div">
                <ActionList.Item as="div" style={{ flexShrink: 1 }}>
                  {loaded && (
                    <Optional
                      content={
                        <OpenGuideButton>
                          <strong>{title(progress)}</strong>
                        </OpenGuideButton>
                      }
                      fallback={<OpenGuideButton />}
                    />
                  )}
                </ActionList.Item>
                <ActionList.Item as="div">
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
                        <ActionList>
                          <ActionList.Item>
                            <OpenGuideButton afterClick={onHide}>
                              <ActionList.Text>Open full guide</ActionList.Text>
                            </OpenGuideButton>
                          </ActionList.Item>
                          <ActionList.Item>
                            <ActionList.Action
                              ariaLabel={false}
                              onClick={(e) => {
                                e.stopPropagation();
                                mute(allItems.map(({ id }) => id));
                                onHide();
                              }}
                            >
                              <ActionList.Icon>
                                <EyeCloseIcon />
                              </ActionList.Icon>
                              <ActionList.Text>Remove from sidebar</ActionList.Text>
                            </ActionList.Action>
                          </ActionList.Item>
                        </ActionList>
                      )}
                    >
                      <ActionList.Button
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
                      </ActionList.Button>
                    </PopoverProvider>
                  )}
                </ActionList.Item>
              </ActionList.Item>
            </ActionList>
          )}
        >
          <ActionList>
            {transitionItems.map(
              ([item, { status, isMounted }]) =>
                isMounted && (
                  <ActionList.HoverItem key={item.id} targetId={item.id} transitionStatus={status}>
                    <ActionList.Action
                      ariaLabel={`Open onboarding guide for ${item.label}`}
                      onClick={() => api.navigate(`/settings/guide#${item.id}`)}
                    >
                      <ActionList.Icon>
                        {item.isCompleted && animated ? (
                          <Particles anchor={Checked} key={item.id} />
                        ) : (
                          <StatusFailIcon />
                        )}
                      </ActionList.Icon>
                      <ActionList.Text>
                        <ItemLabel isCompleted={item.isCompleted} isSkipped={item.isSkipped}>
                          {item.label}
                        </ItemLabel>
                      </ActionList.Text>
                    </ActionList.Action>
                    {item.action && (
                      <ActionList.Button
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
                      </ActionList.Button>
                    )}
                  </ActionList.HoverItem>
                )
            )}
          </ActionList>
        </Collapsible>
      </HoverCard>
    </CollapsibleWithMargin>
  );
};
