/* these imports are in the exact order in which the panels need to be registered */
import { global } from '@storybook/global';

import { addons } from 'storybook/manager-api';

// THE ORDER OF THESE IMPORTS MATTERS! IT DEFINES THE ORDER OF PANELS AND TOOLS!
import controlsManager from '../../controls/manager';
import actionsManager from '../../actions/manager';
import componentTestingManager from '../../component-testing/manager';
import backgroundsManager from '../../backgrounds/manager';
import measureManager from '../../measure/manager';
import outlineManager from '../../outline/manager';
import viewportManager from '../../viewport/manager';

const TAG_FILTERS = 'tag-filters';
const STATIC_FILTER = 'static-filter';

const tagFiltersManager = addons.register(TAG_FILTERS, (api) => {
  // FIXME: this ensures the filter is applied after the first render
  //        to avoid a strange race condition in Webkit only.
  const staticExcludeTags = Object.entries(global.TAGS_OPTIONS ?? {}).reduce(
    (acc, entry) => {
      const [tag, option] = entry;
      if ((option as any).excludeFromSidebar) {
        acc[tag] = true;
      }
      return acc;
    },
    {} as Record<string, boolean>
  );

  api.experimental_setFilter(STATIC_FILTER, (item) => {
    const tags = item.tags ?? [];
    return (
      // we can filter out the primary story, but we still want to show autodocs
      (tags.includes('dev') || item.type === 'docs') &&
      tags.filter((tag) => staticExcludeTags[tag]).length === 0
    );
  });
});

export default [
  measureManager,
  tagFiltersManager,
  actionsManager,
  backgroundsManager,
  componentTestingManager,
  controlsManager,
  viewportManager,
  outlineManager,
];
