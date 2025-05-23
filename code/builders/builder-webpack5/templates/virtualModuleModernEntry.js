import { createBrowserChannel } from 'storybook/internal/channels';
import { STORY_HOT_UPDATED } from 'storybook/internal/core-events';
import { isPreview } from 'storybook/internal/csf';

import { global } from '@storybook/global';

import { PreviewWeb, addons, composeConfigs } from 'storybook/preview-api';
import { importFn } from '{{storiesFilename}}';

const getProjectAnnotations = () => {
  const previewAnnotations = ['{{previewAnnotations_requires}}'];
  // the last one in this array is the user preview
  const userPreview = previewAnnotations[previewAnnotations.length - 1]?.default;

  if (isPreview(userPreview)) {
    return userPreview.composed;
  }

  return composeConfigs(previewAnnotations);
};

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
  import.meta.webpackHot.addStatusHandler((status) => {
    if (status === 'idle') {
      preview.channel.emit(STORY_HOT_UPDATED);
    }
  });

  import.meta.webpackHot.accept('{{storiesFilename}}', () => {
    // importFn has changed so we need to patch the new one in
    preview.onStoriesChanged({ importFn });
  });

  import.meta.webpackHot.accept(['{{previewAnnotations}}'], () => {
    // getProjectAnnotations has changed so we need to patch the new one in
    preview.onGetProjectAnnotationsChanged({ getProjectAnnotations });
  });
}
