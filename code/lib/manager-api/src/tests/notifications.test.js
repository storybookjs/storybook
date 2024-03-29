import { describe, it, expect, vi } from 'vitest';
import { init as initNotifications } from '../modules/notifications';

describe('notifications API', () => {
  it('allows adding notifications', () => {
    const store = {
      getState: () => ({
        notifications: [],
      }),
      setState: vi.fn(),
    };

    const { api } = initNotifications({ store });

    api.addNotification({ id: '1' });
    expect(store.setState).toHaveBeenCalledWith({
      notifications: [{ id: '1' }],
    });
  });

  it('allows removing notifications', () => {
    const store = {
      getState: () => ({
        notifications: [{ id: '1' }, { id: '2' }, { id: '3' }],
      }),
      setState: vi.fn(),
    };

    const { api } = initNotifications({ store });

    api.clearNotification('2');
    expect(store.setState).toHaveBeenCalledWith({
      notifications: [{ id: '1' }, { id: '3' }],
    });
  });
});
