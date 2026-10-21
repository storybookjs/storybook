import type { BeforeEach } from 'storybook/internal/types';

import { VISION_GLOBAL_KEY } from './constants.ts';
import { FILTER_DEFS_ID, filterDefs, filters } from './visionSimulatorFilters.ts';

const FILTER_STYLE_ID = 'storybook-a11y-vision-style';

// Its own copies only: a story may render the same filter definitions, as the toolbar does.
const findOwn = (id: string) => document.querySelector(`:root > #${id}`);

const removeVisionFilter = () => {
  findOwn(FILTER_STYLE_ID)?.remove();
  findOwn(FILTER_DEFS_ID)?.remove();
};

// Runs before every render of a story, also of one that runs no decorators, and leaves nothing
// once the story is left. The style and the filter definitions are children of <html>, outside
// <head> and <body>: the renderer of a story with layout 'document' may replace the body, and
// remove what was added to <head> while it renders. Each render finds them by id, and adds them
// again when a render removed them.
export const applyVisionSimulator: BeforeEach = ({ globals, parameters, viewMode }) => {
  if (typeof globalThis.document === 'undefined') {
    return;
  }

  const visionFilter = filters[globals[VISION_GLOBAL_KEY] as keyof typeof filters]?.filter;
  if (!visionFilter) {
    removeVisionFilter();
    return;
  }

  if (!findOwn(FILTER_DEFS_ID)) {
    document.documentElement.insertAdjacentHTML('beforeend', filterDefs);
  }

  // A story with layout 'document' owns the body, whichever body the document has. Any other story
  // is filtered only while the preview shows it, not its error or loading state. `!important`, so
  // the simulator wins over a filter a story sets in its body's inline style. Not the root element,
  // which would keep `position: fixed` content in place: Firefox renders no `url()` filter on it.
  const selector =
    viewMode === 'story' && parameters.layout === 'document' ? 'body' : '.sb-show-main';
  const css = `${selector} { filter: ${visionFilter} !important; }`;
  let style = findOwn(FILTER_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = FILTER_STYLE_ID;
    document.documentElement.appendChild(style);
  }
  if (style.textContent !== css) {
    style.textContent = css;
  }

  return removeVisionFilter;
};
