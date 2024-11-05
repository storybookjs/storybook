import React, { type ReactElement, useState } from 'react';

import { TooltipLinkList, WithTooltip } from '@storybook/core/components';
import { styled, useTheme } from '@storybook/core/theming';
import {
  EllipsisIcon,
  PlayHollowIcon,
  StatusFailIcon,
  StatusPassIcon,
  StatusWarnIcon,
  SyncIcon,
} from '@storybook/icons';
import type { API_StatusValue } from '@storybook/types';

import { type State, useChannel } from '@storybook/core/manager-api';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';
import { StatusButton } from './StatusButton';

const STATUS_ORDER: API_StatusValue[] = ['success', 'error', 'warn', 'pending', 'unknown'];

const MenuButton = styled(StatusButton)<{ forceVisible: boolean }>(({ forceVisible }) => ({
  visibility: forceVisible ? 'visible' : ('var(--story-menu-visibility, hidden)' as any),
  '&:active, &:focus': {
    visibility: 'visible',
  },
}));

const hideOnClick = (links: Link[][], onHide: () => void) =>
  links.map((group) =>
    group.map((link) => ({
      ...link,
      onClick: (...args: Parameters<NonNullable<Link['onClick']>>) => {
        link.onClick?.(...args);
        onHide();
      },
    }))
  );

interface StoryMenuProps {
  storyId: string;
  isSelected: boolean;
  onSelectStoryId: (itemId: string) => void;
  actions: State['actions'][keyof State['actions']];
  status: State['status'][keyof State['status']];
  statusIcon: ReactElement | null;
  statusValue: API_StatusValue;
}

export const StoryMenu = ({
  storyId,
  isSelected,
  onSelectStoryId,
  actions,
  status,
  statusIcon,
  statusValue,
}: StoryMenuProps) => {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();
  const emit = useChannel({});

  const links: Link[][] = [
    // Story options (built-ins):
    [
      // {
      //   id: 'rename',
      //   title: 'Rename story',
      //   onClick: () => console.log('Rename'),
      //   icon: <TypeIcon />,
      // },
    ],

    // Story statuses:
    Object.entries(status || {})
      .sort((a, b) => STATUS_ORDER.indexOf(a[1].status) - STATUS_ORDER.indexOf(b[1].status))
      .map(([addonId, value]) => ({
        id: addonId,
        title: value.title,
        center: value.description,
        right: value.data?.score ?? value.count,
        'aria-label': `Test status for ${value.title}: ${value.status}`,
        icon: {
          success: <StatusPassIcon color={theme.color.positive} />,
          error: <StatusFailIcon color={theme.color.negative} />,
          warn: <StatusWarnIcon color={theme.color.warning} />,
          pending: <SyncIcon size={12} color={theme.color.defaultText} />,
          unknown: null,
        }[value.status],
        onClick: () => {
          onSelectStoryId(storyId);
          value.onClick?.();
        },
      })),

    // Story actions:
    Object.entries(actions || {}).map(([addonId, value]) => ({
      id: addonId,
      title: value.title,
      center: value.description,
      icon: <PlayHollowIcon color={theme.textMutedColor} />,
      onClick: () => emit(value.event, [storyId]),
    })),
  ];

  if (!links.some((group) => group.some(Boolean))) {
    return null;
  }

  return (
    <WithTooltip
      closeOnOutsideClick
      closeOnTriggerHidden
      onClick={(event) => event.stopPropagation()}
      onVisibleChange={setVisible}
      placement="bottom"
      tooltip={({ onHide }) => <TooltipLinkList links={hideOnClick(links, onHide)} />}
    >
      <MenuButton
        aria-label="Story menu"
        type="button"
        status={statusValue}
        selectedItem={isSelected}
        forceVisible={visible || !!statusIcon}
      >
        {statusIcon || <EllipsisIcon />}
      </MenuButton>
    </WithTooltip>
  );
};
