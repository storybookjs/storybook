import type { FC } from 'react';
import React from 'react';

import type { Combo } from '@storybook/core/manager-api';
import { Consumer } from '@storybook/core/manager-api';

import { NotificationList } from '../components/notifications/NotificationList';

const mapper = ({ state, api }: Combo) => {
  return {
    notifications: state.notifications,
    clearNotification: api.clearNotification,
  };
};

export const Notifications: FC = (props) => (
  <Consumer filter={mapper}>
    {(fromState) => <NotificationList {...props} {...fromState} />}
  </Consumer>
);
