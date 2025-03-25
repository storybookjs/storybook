import React, { useEffect, useRef, useState } from 'react';

import type { Channel } from 'storybook/internal/channels';
import { ListItem } from 'storybook/internal/components';

import { ChevronSmallLeftIcon, ChevronSmallRightIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import type { Box } from './types';

const Menu = styled.div(({ theme }) => ({
  position: 'absolute',
  backgroundColor: theme.background.content,
  borderRadius: 6,
  width: 300,
  marginTop: 15,
  marginLeft: -150,
  zIndex: 2147483647,
  boxShadow: `0 2px 5px 0 rgba(0, 0, 0, 0.05), 0 5px 15px 0 rgba(0, 0, 0, 0.1)`,
}));

const Group = styled.div(({ theme }) => ({
  padding: 4,
  '& + &': {
    borderTop: `1px solid ${theme.appBorderColor}`,
  },
}));

const Monospaced = styled.div<{ withIcon?: boolean }>(({ theme, withIcon = false }) => ({
  maxWidth: withIcon ? 248 : 272,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  fontWeight: theme.typography.weight.regular,
}));

const MenuListItems = ({ channel, target }: { channel: Channel; target: Box }) => (
  <Group>
    {target.menuListItems?.map((item) => (
      <ListItem
        key={item.id}
        onClick={() => {
          if (item.clickEvent) {
            channel.emit(item.clickEvent, item);
          }
        }}
        {...item}
      />
    ))}
  </Group>
);

export const HighlightMenu = ({
  channel,
  coordinates,
  targets,
  setFocused,
}: {
  channel: Channel;
  coordinates: { x: number; y: number };
  targets: Box[];
  setFocused: (element: Element) => void;
}) => {
  const [selected, setSelected] = useState<Box>();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSelected((s) => targets.find((t) => t === s)), [targets]);

  useEffect(() => {
    const menu = menuRef.current;
    if (menu && menu.offsetTop + menu.offsetHeight > window.innerHeight) {
      menu.style.top = `${coordinates.y - menu.offsetHeight}px`;
    }
  }, [coordinates]);

  const menuProps = {
    ref: menuRef,
    id: 'addon-highlight-menu',
    style: {
      left: Math.max(Math.min(coordinates.x, window.innerWidth - 155), 155),
      top: coordinates.y,
    },
    onClick: (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation(),
  };

  if (targets.length === 0) {
    return null;
  }

  if (targets.length === 1) {
    const target = targets[0];
    return (
      <Menu {...menuProps}>
        <Group>
          <ListItem title={<Monospaced>{target.element.outerHTML}</Monospaced>} />
        </Group>
        <MenuListItems channel={channel} target={target} />
      </Menu>
    );
  }

  if (selected) {
    return (
      <Menu {...menuProps}>
        <Group>
          <ListItem
            title={<Monospaced withIcon>{selected.element.outerHTML}</Monospaced>}
            icon={<ChevronSmallLeftIcon />}
            onClick={() => setSelected(undefined)}
          />
        </Group>
        <MenuListItems channel={channel} target={selected} />
      </Menu>
    );
  }

  return (
    <Menu {...menuProps}>
      <Group>
        {targets.map((target, index) => {
          const { element, top, left, width, height } = target;
          return (
            <ListItem
              key={`${top}-${left}-${width}-${height}-${index}`}
              title={<Monospaced withIcon>{element.outerHTML}</Monospaced>}
              right={targets.length > 1 && <ChevronSmallRightIcon fill="currentColor" />}
              onMouseEnter={() => setFocused(element)}
              onClick={() => setSelected(target)}
            />
          );
        })}
      </Group>
    </Menu>
  );
};
