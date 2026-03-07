import React, { memo, useCallback, useEffect } from 'react';

import { Select } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { PlayAllHollowIcon } from '@storybook/icons';

import { types, useGlobals } from 'storybook/manager-api';

import type { StoryAutoplay } from '../../../../component-testing/preview';

const AUTOPLAY_STORAGE_KEY = 'storybook-story-autoplay';

const OPTIONS = [
  { value: 'no-reduced-motion', title: 'Auto (reduced motion)' },
  { value: 'always', title: 'Always autoplay' },
  { value: 'never', title: 'Never autoplay' },
];

export const AutoplayTool = memo(function AutoplayTool() {
  const [globals, updateGlobals, storyGlobals] = useGlobals();

  const currentValue: StoryAutoplay = globals?.storyAutoplay ?? 'no-reduced-motion';
  const isLocked = !!storyGlobals?.storyAutoplay;

  // Restore saved preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOPLAY_STORAGE_KEY);
      if (saved && ['always', 'never', 'no-reduced-motion'].includes(saved)) {
        updateGlobals({ storyAutoplay: saved as StoryAutoplay });
      }
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  const handleSelect = useCallback(
    (selected: string | number) => {
      const value = selected as StoryAutoplay;
      updateGlobals({ storyAutoplay: value });
      try {
        localStorage.setItem(AUTOPLAY_STORAGE_KEY, value);
      } catch {
        // localStorage may be unavailable
      }
    },
    [updateGlobals]
  );

  const handleReset = useCallback(() => {
    updateGlobals({ storyAutoplay: undefined });
    try {
      localStorage.removeItem(AUTOPLAY_STORAGE_KEY);
    } catch {
      // localStorage may be unavailable
    }
  }, [updateGlobals]);

  return (
    <Select
      key="story-autoplay"
      icon={<PlayAllHollowIcon />}
      ariaLabel={
        isLocked ? 'Story autoplay set by story parameters' : 'Change story autoplay setting'
      }
      tooltip={isLocked ? 'Story autoplay set by story parameters' : 'Story autoplay'}
      disabled={isLocked}
      defaultOptions={currentValue}
      options={OPTIONS}
      onSelect={handleSelect}
      onReset={handleReset}
      resetLabel="Reset autoplay"
    />
  );
});

export const autoplayTool: Addon_BaseType = {
  title: 'story-autoplay',
  id: 'story-autoplay',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => <AutoplayTool />,
};
