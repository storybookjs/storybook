import { addons } from 'storybook/internal/manager-api';

import EVENTS, { ADDON_ID } from './constants';

addons.register(ADDON_ID, (api) => {
  api.on(EVENTS.REQUEST, ({ kind, name }) => {
    const id = api.storyId(kind, name);
    api.emit(EVENTS.RECEIVE, id);
  });
});
