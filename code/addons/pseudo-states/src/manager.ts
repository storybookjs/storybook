import { addons, types } from 'storybook/manager-api';

import { ADDON_ID, TOOL_ID } from './constants';
import { PseudoStateTool } from './manager/PseudoStateTool';

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: 'CSS pseudo states',
    match: ({ viewMode }) => viewMode === 'story',
    render: PseudoStateTool,
  });
});
