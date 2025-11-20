import React, { useEffect, useRef, useState } from 'react';

import {
  Card,
  Collapsible,
  Listbox,
  ProgressSpinner,
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

const CollapseToggle = styled(Listbox.Button)({
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

const OpenGuideAction = ({ children }: { children?: React.ReactNode }) => {
  const api = useStorybookApi();
  return (
    <Listbox.Action
      ariaLabel="Open onboarding guide"
      onClick={(e) => {
        e.stopPropagation();
        api.navigate('/settings/guide');
      }}
    >
      <Listbox.Icon>
        <ListUnorderedIcon />
      </Listbox.Icon>
      {children}
    </Listbox.Action>
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
      <HoverCard outlineAnimation="rainbow">
        <Collapsible
          collapsed={!hasItems}
          disabled={!hasItems}
          summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
            <Listbox onClick={toggleCollapsed}>
              <Listbox.Item>
                <Listbox.Item style={{ flexShrink: 1 }}>
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
                </Listbox.Item>
                <Listbox.Item>
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
                    <WithTooltip
                      as="div"
                      closeOnOutsideClick
                      tooltip={({ onHide }) => (
                        <Listbox as="ul">
                          <Listbox.Item as="li">
                            <OpenGuideAction>
                              <Listbox.Text>Open full guide</Listbox.Text>
                            </OpenGuideAction>
                          </Listbox.Item>
                          <Listbox.Item as="li">
                            <Listbox.Action
                              ariaLabel={false}
                              onClick={(e) => {
                                e.stopPropagation();
                                mute(allItems.map(({ id }) => id));
                                onHide();
                              }}
                            >
                              <Listbox.Icon>
                                <EyeCloseIcon />
                              </Listbox.Icon>
                              <Listbox.Text>Remove from sidebar</Listbox.Text>
                            </Listbox.Action>
                          </Listbox.Item>
                        </Listbox>
                      )}
                    >
                      <Listbox.Button
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
                      </Listbox.Button>
                    </WithTooltip>
                  )}
                </Listbox.Item>
              </Listbox.Item>
            </Listbox>
          )}
        >
          <Listbox as="ul">
            {transitionItems.map(
              ([item, { status, isMounted }]) =>
                isMounted && (
                  <Listbox.HoverItem
                    as="li"
                    key={item.id}
                    targetId={item.id}
                    transitionStatus={status}
                  >
                    <Listbox.Action
                      ariaLabel={`Open onboarding guide for ${item.label}`}
                      onClick={() => api.navigate(`/settings/guide#${item.id}`)}
                    >
                      <Listbox.Icon>
                        {item.isCompleted ? (
                          <Particles anchor={Checked} key={item.id} />
                        ) : (
                          <StatusFailIcon />
                        )}
                      </Listbox.Icon>
                      <Listbox.Text>
                        <ItemLabel isCompleted={item.isCompleted} isSkipped={item.isSkipped}>
                          {item.label}
                        </ItemLabel>
                      </Listbox.Text>
                    </Listbox.Action>
                    {item.action && (
                      <Listbox.Button
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
                      </Listbox.Button>
                    )}
                  </Listbox.HoverItem>
                )
            )}
          </Listbox>
        </Collapsible>
      </HoverCard>
    </CollapsibleWithMargin>
  );
};
