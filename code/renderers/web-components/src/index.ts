/// <reference types="webpack-env" />
import { global } from '@storybook/global';

import './globals';

const { window, EventSource } = global;

export * from './public-types';
export * from './framework-api';

// TODO: disable HMR and do full page loads because of customElements.define
if (typeof module !== 'undefined' && module?.hot?.decline) {
  module.hot.decline();

  // forcing full reloads for customElements as elements can only be defined once per page
  const hmr = new EventSource('__webpack_hmr');
  hmr.addEventListener('message', function fullPageReload(event: { data: string }) {
    try {
      // Only care for built events.  Heartbeats are not parsable so we ignore those
      const { action } = JSON.parse(event.data);
      if (action === 'built') {
        window.location.reload();
      }
    } catch (error) {
      // Most part we only get here from the data in the server-sent event not being parsable which is ok
    }
  });
}
