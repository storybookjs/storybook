import type { FC, PropsWithChildren } from 'react';
import React, { Component, useCallback } from 'react';

import { type API, useStorybookApi, useStorybookState } from '@storybook/core/manager-api';

import { AboutScreen } from './About';

// Clear a notification on mount. This could be exported by core/notifications.js perhaps?
class NotificationClearer extends Component<
  PropsWithChildren<{ api: API; notificationId: string }>
> {
  componentDidMount() {
    const { api, notificationId } = this.props;
    api.clearNotification(notificationId);
  }

  render() {
    const { children } = this.props;
    return children;
  }
}

export const AboutPage: FC = () => {
  const api = useStorybookApi();
  const state = useStorybookState();

  const onNavigateToWhatsNew = useCallback(() => {
    api.changeSettingsTab('whats-new');
  }, [api]);
  return (
    <NotificationClearer api={api} notificationId="update">
      <AboutScreen
        onNavigateToWhatsNew={
          state.whatsNewData?.status === 'SUCCESS' ? onNavigateToWhatsNew : undefined
        }
      />
    </NotificationClearer>
  );
};
