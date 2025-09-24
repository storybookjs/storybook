import React from 'react';

import { IconButton } from 'storybook/internal/components';

import { EyeCloseIcon, EyeIcon } from '@storybook/icons';

import { useStoryInspector } from '../hooks/useStoryInspector';

export const StoryInspectorTool = () => {
  const { isEnabled, toggleInspector, components } = useStoryInspector();

  const { withStories, withoutStories } = components;
  const totalComponents = withStories.length + withoutStories.length;

  const title = isEnabled
    ? `Story Inspector: ON (${totalComponents} components found: ${withStories.length} with stories, ${withoutStories.length} without)`
    : 'Story Inspector: OFF - Click to scan for components';

  return (
    <IconButton key="story-inspector" active={isEnabled} title={title} onClick={toggleInspector}>
      {isEnabled ? <EyeIcon /> : <EyeCloseIcon />}
      {totalComponents > 0 && isEnabled && (
        <span
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: withoutStories.length > 0 ? '#f59e0b' : '#22c55e',
            color: 'white',
            borderRadius: '50%',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: 'bold',
            minWidth: '16px',
            textAlign: 'center',
          }}
        >
          {totalComponents}
        </span>
      )}
    </IconButton>
  );
};
