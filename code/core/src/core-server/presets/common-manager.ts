/* these imports are in the exact order in which the panels need to be registered */

// THE ORDER OF THESE IMPORTS MATTERS! IT DEFINES THE ORDER OF PANELS AND TOOLS!
import controlsManager from '../../controls/manager';
import actionsManager from '../../actions/manager';
import componentTestingManager from '../../component-testing/manager';
import backgroundsManager from '../../backgrounds/manager';
import measureManager from '../../measure/manager';
import outlineManager from '../../outline/manager';
import viewportManager from '../../viewport/manager';

export default [
  measureManager,
  actionsManager,
  backgroundsManager,
  componentTestingManager,
  controlsManager,
  viewportManager,
  outlineManager,
];
