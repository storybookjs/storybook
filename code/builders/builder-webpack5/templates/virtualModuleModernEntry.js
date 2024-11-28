import { createBrowserChannel } from 'storybook/internal/channels';
import { PreviewWeb, addons, composeConfigs } from 'storybook/internal/preview-api';

import { global } from '@storybook/global';
import { importFn } from './stories/index.js';

const PREVIEW_PATH = './preview.js';
const STORIES_PATH = './stories/index.js';

const getProjectAnnotations = () => composeConfigs([PREVIEW_PATH]);

const channel = createBrowserChannel({ page: 'preview' });
addons.setChannel(channel);

if (global.CONFIG_TYPE === 'DEVELOPMENT') {
  window.__STORYBOOK_SERVER_CHANNEL__ = channel;
}

const preview = new PreviewWeb(importFn, getProjectAnnotations);
window.__STORYBOOK_PREVIEW__ = preview;
window.__STORYBOOK_STORY_STORE__ = preview.storyStore;
window.__STORYBOOK_ADDONS_CHANNEL__ = channel;

const handleHotModuleReplacement = (path, callback) => {
  import.meta.webpackHot.accept(path, (err) => {
    if (err) {
      console.error(`Error accepting module at ${path}:`, err);
    } else {
      callback();
    }
  });
};

if (import.meta.webpackHot) {
  handleHotModuleReplacement(STORIES_PATH, () => {
    // importFn has changed so we need to patch the new one in
    preview.onStoriesChanged({ importFn });
  });

  handleHotModuleReplacement(PREVIEW_PATH, () => {
    // getProjectAnnotations has changed so we need to patch the new one in
    preview.onGetProjectAnnotationsChanged({ getProjectAnnotations });
  });
}
