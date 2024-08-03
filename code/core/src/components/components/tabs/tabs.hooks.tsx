import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { sanitize } from '@storybook/csf';
import { styled } from '@storybook/core/theming';
import useResizeObserver from 'use-resize-observer';
import { TabButton } from '../bar/button';
import { TooltipLinkList } from '../tooltip/TooltipLinkList';
import { WithTooltip } from '../tooltip/WithTooltip';
import type { ChildrenListComplete } from './tabs.helpers';
import type { Link } from '../tooltip/TooltipLinkList';

const CollapseIcon = styled.span<{ isActive: boolean }>(({ theme, isActive }) => ({
  display: 'inline-block',
  width: 0,
  height: 0,
  marginLeft: 8,
  color: isActive ? theme.color.secondary : theme.color.mediumdark,
  borderRight: '3px solid transparent',
  borderLeft: `3px solid transparent`,
  borderTop: '3px solid',
  transition: 'transform .1s ease-out',
}));

const AddonButton = styled(TabButton)<{ preActive: boolean }>(({ active, theme, preActive }) => {
  return `
    color: ${preActive || active ? theme.barSelectedColor : theme.barTextColor};
    .addon-collapsible-icon {
      color: ${preActive || active ? theme.barSelectedColor : theme.barTextColor};
    }
    &:hover {
      color: ${theme.barHoverColor};
      .addon-collapsible-icon {
        color: ${theme.barHoverColor};
      }
    }
  `;
});

export function useList(list: ChildrenListComplete) {
  const tabBarRef = useRef<HTMLDivElement>();
  const addonsRef = useRef<HTMLButtonElement>();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const { width: tabBarWidth = 1 } = useResizeObserver<HTMLDivElement>({
    // @ts-expect-error (non strict)
    ref: tabBarRef,
  });

  const [visibleList, setVisibleList] = useState(list);
  const [invisibleList, setInvisibleList] = useState<ChildrenListComplete>([]);
  const previousList = useRef<ChildrenListComplete>(list);

  const AddonTab = useCallback(
    ({
      menuName,
      actions,
    }: {
      menuName: string;
      actions?: {
        onSelect: (id: string) => void;
      } & Record<string, any>;
    }) => {
      const isAddonsActive = invisibleList.some(({ active }) => active);
      const [isTooltipVisible, setTooltipVisible] = useState(false);
      return (
        <>
          <WithTooltip
            interactive
            visible={isTooltipVisible}
            onVisibleChange={setTooltipVisible}
            placement="bottom"
            delayHide={100}
            tooltip={
              <TooltipLinkList
                links={invisibleList.map(({ title, id, color, active }) => {
                  return {
                    id,
                    title,
                    color,
                    active,
                    onClick: (e) => {
                      e.preventDefault();
                      // @ts-expect-error (non strict)
                      actions.onSelect(id);
                    },
                  } as Link;
                })}
              />
            }
          >
            <AddonButton
              // @ts-expect-error (non strict)
              ref={addonsRef}
              active={isAddonsActive}
              preActive={isTooltipVisible}
              style={{ visibility: invisibleList.length ? 'visible' : 'hidden' }}
              aria-hidden={!invisibleList.length}
              className="tabbutton"
              type="button"
              role="tab"
            >
              {menuName}
              <CollapseIcon
                className="addon-collapsible-icon"
                isActive={isAddonsActive || isTooltipVisible}
              />
            </AddonButton>
          </WithTooltip>
          {invisibleList.map(({ title, id, color }, index) => {
            const indexId = `index-${index}`;
            return (
              <TabButton
                id={`tabbutton-${sanitize(id) ?? indexId}`}
                style={{ visibility: 'hidden' }}
                aria-hidden
                tabIndex={-1}
                ref={(ref: HTMLButtonElement) => {
                  tabRefs.current.set(id, ref);
                }}
                className="tabbutton"
                type="button"
                key={id}
                textColor={color}
                role="tab"
              >
                {/* @ts-expect-error (we know this is broken) */}
                {title}
              </TabButton>
            );
          })}
        </>
      );
    },
    [invisibleList]
  );

  const setTabLists = useCallback(() => {
    // get x and width from tabBarRef div
    if (!tabBarRef.current || !addonsRef.current) {
      return;
    }
    const { x, width } = tabBarRef.current.getBoundingClientRect();
    const { width: widthAddonsTab } = addonsRef.current.getBoundingClientRect();
    const rightBorder = invisibleList.length ? x + width - widthAddonsTab : x + width;

    const newVisibleList: ChildrenListComplete = [];

    let widthSum = 0;

    const newInvisibleList = list.filter((item) => {
      const { id } = item;
      const tabButton = tabRefs.current.get(id);
      const { width: tabWidth = 0 } = tabButton?.getBoundingClientRect() || {};

      const crossBorder = x + widthSum + tabWidth > rightBorder;

      //  `!tabButton` happens when new tab has just been added
      if (!crossBorder || !tabButton) {
        newVisibleList.push(item);
      }

      widthSum += tabWidth;

      return crossBorder;
    });

    if (newVisibleList.length !== visibleList.length || previousList.current !== list) {
      setVisibleList(newVisibleList);
      setInvisibleList(newInvisibleList);
      previousList.current = list;
    }
  }, [invisibleList.length, list, visibleList]);

  useLayoutEffect(setTabLists, [setTabLists, tabBarWidth]);

  return {
    tabRefs,
    addonsRef,
    tabBarRef,
    visibleList,
    invisibleList,
    AddonTab,
  };
}
