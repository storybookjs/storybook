import { createBrowserChannel } from 'storybook/internal/channels';
import { PreviewWeb, addons, composeConfigs } from 'storybook/internal/preview-api';

import { global } from '@storybook/global';

import { importFn } from '{{storiesFilename}}';

const getProjectAnnotations = () => composeConfigs(['{{previewAnnotations_requires}}']);

const channel = createBrowserChannel({ page: 'preview' });
addons.setChannel(channel);

if (global.CONFIG_TYPE === 'DEVELOPMENT') {
  window.__STORYBOOK_SERVER_CHANNEL__ = channel;
}

const preview = new PreviewWeb(importFn, getProjectAnnotations);

window.__STORYBOOK_PREVIEW__ = preview;
window.__STORYBOOK_STORY_STORE__ = preview.storyStore;
window.__STORYBOOK_ADDONS_CHANNEL__ = channel;

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept('{{storiesFilename}}', () => {
    // importFn has changed so we need to patch the new one in
    preview.onStoriesChanged({ importFn });
  });

  import.meta.webpackHot.accept(['{{previewAnnotations}}'], () => {
    // getProjectAnnotations has changed so we need to patch the new one in
    preview.onGetProjectAnnotationsChanged({ getProjectAnnotations });
  });
}
