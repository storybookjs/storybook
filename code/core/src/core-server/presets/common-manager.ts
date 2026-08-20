/* these imports are in the exact order in which the panels need to be registered */

// THE ORDER OF THESE IMPORTS MATTERS! IT DEFINES THE ORDER OF PANELS AND TOOLS!
import docgenManager from '../../shared/open-service/services/docgen/manager.tsx';
import storyDocsManager from '../../shared/open-service/services/story-docs/manager.tsx';
import dynamicSnippetsManager from '../../shared/open-service/services/dynamic-snippets/manager.tsx';
import reviewManager from '../../shared/open-service/services/review/manager.tsx';
import controlsManager from '../../controls/manager.tsx';
import actionsManager from '../../actions/manager.tsx';
import componentTestingManager from '../../component-testing/manager.tsx';
import backgroundsManager from '../../backgrounds/manager.tsx';
import measureManager from '../../measure/manager.tsx';
import outlineManager from '../../outline/manager.tsx';
import viewportManager from '../../viewport/manager.tsx';

export default [
  docgenManager,
  storyDocsManager,
  dynamicSnippetsManager,
  reviewManager,
  measureManager,
  actionsManager,
  backgroundsManager,
  componentTestingManager,
  controlsManager,
  viewportManager,
  outlineManager,
];
