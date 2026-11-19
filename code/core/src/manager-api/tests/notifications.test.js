import { describe, expect, it, vi } from 'vitest';

import { init as initNotifications } from '../modules/notifications';
import Store from '../store';
import { createLaggingUpstream } from '../test-utils/store';

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

  describe('with a store that commits later, like React', () => {
    it('keeps a notification added by onClear when clearing', () => {
      const upstream = createLaggingUpstream({ notifications: [] });
      const realStore = new Store(upstream);
      const { api } = initNotifications({ store: realStore });
      api.addNotification({ id: 'a', onClear: () => api.addNotification({ id: 'b' }) });
      upstream.commit();

      api.clearNotification('a');

      expect(realStore.getState().notifications.map((n) => n.id)).toEqual(['b']);
      upstream.commit();
      expect(upstream.getState().notifications.map((n) => n.id)).toEqual(['b']);
    });

    it('keeps a notification added by onClear when replacing one with the same id', () => {
      const upstream = createLaggingUpstream({ notifications: [] });
      const realStore = new Store(upstream);
      const { api } = initNotifications({ store: realStore });
      api.addNotification({ id: 'a', onClear: () => api.addNotification({ id: 'b' }) });
      upstream.commit();

      api.addNotification({ id: 'a' });

      expect(realStore.getState().notifications.map((n) => n.id)).toEqual(['a', 'b']);
      upstream.commit();
      expect(upstream.getState().notifications.map((n) => n.id)).toEqual(['a', 'b']);
    });
  });
});
