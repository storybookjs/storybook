import React from 'react';

import { IconButton } from 'storybook/internal/components';

import { PaintBrushAltIcon, PaintBrushIcon } from '@storybook/icons';

import { useGlobals } from 'storybook/manager-api';

import { PARAM_KEY } from '../constants';
import { useStoryInspector } from '../hooks/useStoryInspector';

export const StoryInspectorTool = () => {
  const [globals, updateGlobals] = useGlobals();
  const isEnabled = !!globals[PARAM_KEY];

  const { components } = useStoryInspector();
  const { withStories, withoutStories } = components;
  const totalComponents = withStories.length + withoutStories.length;

  const toggleInspector = () => {
    updateGlobals({ [PARAM_KEY]: !isEnabled });
  };

  const title = isEnabled
    ? `Story Inspector: ON (${totalComponents} components found: ${withStories.length} with stories, ${withoutStories.length} without)`
    : 'Story Inspector: OFF - Click to scan for components';

  return (
    <IconButton key="story-inspector" active={isEnabled} title={title} onClick={toggleInspector}>
      <PaintBrushAltIcon />
      {totalComponents > 0 && isEnabled && (
        <span
          style={{
            position: 'absolute',
            background: withoutStories.length > 0 ? '#f59e0b' : '#22c55e',
            color: 'white',
            borderRadius: '50% 0 30% 0',
            fontSize: '8px',
            lineHeight: '15px',
            fontWeight: 'bold',
            bottom: 0,
            right: 0,
            width: '14px',
            height: '14px',
            textAlign: 'center',
          }}
        >
          {totalComponents > 9 ? '9+' : totalComponents}
        </span>
      )}
    </IconButton>
  );
};
