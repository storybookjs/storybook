import { STORY_CHANGED } from 'storybook/internal/core-events';
import { addons } from 'storybook/internal/manager-api';

import { ADDON_ID, REQUEST_EVENT } from './constants';

addons.register(ADDON_ID, (api) => {
  // addons.add(ADDON_ID, {
  //   title: 'viewport / media-queries',
  //   type: types.TOOL,
  //   match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  //   render: () =>
  //     FEATURES?.viewportStoryGlobals ? <ViewportTool api={api} /> : <ViewportToolLegacy />,
  // });
  api.on(STORY_CHANGED, () => {
    const { importPath, ...data } = api.getCurrentStoryData();
    api.emit(REQUEST_EVENT, {
      importPath,
      componentPath: (data as any).componentPath as string,
    });
  });
});
