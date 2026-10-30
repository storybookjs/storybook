import React from 'react';

import { addons, types, useGlobals } from 'storybook/manager-api';

import { ADDON_ID, GLOBAL_KEY } from './constants.ts';

function GridTool(): React.ReactElement {
  const [globals, updateGlobals] = useGlobals();
  const isActive = globals[GLOBAL_KEY] === true;

  return (
    <button
      type="button"
      title="Toggle grid"
      aria-pressed={isActive}
      onClick={() => updateGlobals({ [GLOBAL_KEY]: !isActive })}
      style={{
        display: 'inline-flex',
        alignSelf: 'center',
        padding: 6,
        border: 0,
        borderRadius: 4,
        cursor: 'pointer',
        color: isActive ? '#029cfd' : 'inherit',
        background: isActive ? 'rgba(2, 156, 253, 0.14)' : 'transparent',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
        <path d="M0.5 0.5h13v13h-13zM5 0.5v13M9.5 0.5v13M0.5 5h13M0.5 9.5h13" />
      </svg>
    </button>
  );
}

addons.register(ADDON_ID, () => {
  addons.add(`${ADDON_ID}/tool`, {
    type: types.TOOL,
    title: 'Grid',
    render: () => <GridTool />,
  });
});
