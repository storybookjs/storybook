/* these imports are in the exact order in which the panels need to be registered */

// THE ORDER OF THESE IMPORTS MATTERS! IT DEFINES THE ORDER OF PANELS AND TOOLS!
import controlsManager from '../../controls/manager.tsx';
import actionsManager from '../../actions/manager.tsx';
import componentTestingManager from '../../component-testing/manager.tsx';
import backgroundsManager from '../../backgrounds/manager.tsx';
import measureManager from '../../measure/manager.tsx';
import outlineManager from '../../outline/manager.tsx';
import viewportManager from '../../viewport/manager.tsx';

export default [
  measureManager,
  actionsManager,
  backgroundsManager,
  componentTestingManager,
  controlsManager,
  viewportManager,
  outlineManager,
];
