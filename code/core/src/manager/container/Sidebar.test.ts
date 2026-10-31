import { describe, expect, it, vi } from 'vitest';

import { isWhatsNewNotificationsEnabled } from './Sidebar.tsx';

vi.mock('storybook/manager-api', () => ({
  Consumer: () => null,
  experimental_useStatusStore: () => ({}),
}));
vi.mock('../components/sidebar/Sidebar.tsx', () => ({ Sidebar: () => null }));
vi.mock('./Menu.tsx', () => ({ useMenu: () => [] }));

const success = (disableWhatsNewNotifications: boolean) =>
  ({
    whatsNewData: {
      status: 'SUCCESS',
      title: '',
      url: '',
      blogUrl: '',
      publishedAt: '',
      excerpt: '',
      postIsRead: false,
      showNotification: true,
      disableWhatsNewNotifications,
    },
  }) as any;

describe('isWhatsNewNotificationsEnabled', () => {
  it('is enabled when notifications are not disabled', () => {
    expect(isWhatsNewNotificationsEnabled(success(false))).toBe(true);
  });

  it('respects disableWhatsNewNotifications from whatsNewData', () => {
    expect(isWhatsNewNotificationsEnabled(success(true))).toBe(false);
  });

  it('is disabled when the data did not load', () => {
    expect(isWhatsNewNotificationsEnabled({ whatsNewData: { status: 'ERROR' } } as any)).toBe(
      false
    );
    expect(isWhatsNewNotificationsEnabled({} as any)).toBe(false);
  });
});
