import type { FC } from 'react';
import React from 'react';

import { styled } from '@storybook/core/theming';

import type { State } from '@storybook/core/manager-api';

import { useLayout } from '../layout/LayoutProvider';
import NotificationItem from './NotificationItem';

interface NotificationListProps {
  notifications: State['notifications'];
  clearNotification: (id: string) => void;
}

export const NotificationList: FC<NotificationListProps> = ({
  notifications,
  clearNotification,
}) => {
  const { isMobile } = useLayout();
  return (
    <List isMobile={isMobile}>
      {notifications &&
        notifications.map((notification, index) => (
          <NotificationItem
            key={notification.id}
            onDismissNotification={(id: string) => clearNotification(id)}
            notification={notification}
            zIndex={notifications.length - index}
          />
        ))}
    </List>
  );
};

const List = styled.div<{ isMobile?: boolean }>(
  {
    zIndex: 200,
    '> * + *': {
      marginTop: 12,
    },
    '&:empty': {
      display: 'none',
    },
  },
  ({ isMobile }) =>
    isMobile && {
      position: 'fixed',
      bottom: 40,
      margin: 20,
    }
);
