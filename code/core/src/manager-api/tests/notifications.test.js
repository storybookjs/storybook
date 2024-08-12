import { describe, expect, it, vi } from 'vitest';

import { init as initNotifications } from '../modules/notifications';

describe('notifications API', () => {
  const store = {
    state: { notifications: [] },
    getState: () => store.state,
    setState: (update) => {
      if (typeof update === 'function') {
        store.state = update(store.state);
      } else {
        store.state = update;
      }
    },
  };

  it('allows adding notifications', () => {
    const { api } = initNotifications({ store });

    api.addNotification({ id: '1' });
    expect(store.getState()).toEqual({
      notifications: [{ id: '1' }],
    });
  });

  it('allows removing notifications', () => {
    store.setState({ notifications: [{ id: '1' }, { id: '2' }, { id: '3' }] });
    const { api } = initNotifications({ store });

    api.clearNotification('2');
    expect(store.getState()).toEqual({
      notifications: [{ id: '1' }, { id: '3' }],
    });
  });
});
