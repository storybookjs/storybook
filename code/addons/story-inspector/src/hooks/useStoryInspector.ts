import { useCallback, useEffect, useState } from 'react';

import type { StoryIndex } from 'storybook/internal/types';

import { HIGHLIGHT, REMOVE_HIGHLIGHT } from 'storybook/highlight';
import type { HighlightMenuItem } from 'storybook/highlight';
import { useChannel, useStorybookState } from 'storybook/manager-api';

import {
  ADDON_ID,
  EVENTS,
  HIGHLIGHT_ID_WITHOUT_STORIES,
  HIGHLIGHT_ID_WITH_STORIES,
} from '../constants';
import {
  type ComponentInfo,
  checkComponentsAgainstIndex,
  findComponentsInDOM,
  generateSelectorsForComponents,
  groupComponentsByStoryStatus,
} from '../utils/story-matcher';

export function useStoryInspector() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [components, setComponents] = useState<ComponentInfo[]>([]);
  const emit = useChannel({});
  const { index } = useStorybookState();

  const toggleInspector = useCallback(() => {
    setIsEnabled((prev) => !prev);
    emit(EVENTS.TOGGLE_INSPECTOR, !isEnabled);
  }, [isEnabled, emit]);

  const createStoryForComponent = useCallback(
    (componentPath: string) => {
      emit(EVENTS.CREATE_STORY_FOR_COMPONENT, { componentPath });
    },
    [emit]
  );

  const scanComponents = useCallback(() => {
    if (!index) {
      return;
    }

    const foundComponents = findComponentsInDOM();
    const componentsWithStoryStatus = checkComponentsAgainstIndex(foundComponents, index as any);
    setComponents(componentsWithStoryStatus);
  }, [index]);

  const updateHighlights = useCallback(() => {
    // Remove existing highlights
    emit(REMOVE_HIGHLIGHT, HIGHLIGHT_ID_WITH_STORIES);
    emit(REMOVE_HIGHLIGHT, HIGHLIGHT_ID_WITHOUT_STORIES);

    if (!isEnabled || components.length === 0) {
      return;
    }

    const { withStories, withoutStories } = groupComponentsByStoryStatus(components);

    // Highlight components with stories
    if (withStories.length > 0) {
      const selectorsWithStories = generateSelectorsForComponents(withStories);

      emit(HIGHLIGHT, {
        id: HIGHLIGHT_ID_WITH_STORIES,
        priority: 1,
        selectors: selectorsWithStories,
        styles: {
          outline: '2px solid #22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
        },
        hoverStyles: {
          outline: '2px solid #16a34a',
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
        },
        menu: withStories.map<HighlightMenuItem[]>((component) => [
          {
            id: `${component.storyId}:info`,
            title: `Component: ${component.componentPath
              .split('/')
              .pop()
              ?.replace(/\.(tsx?|jsx?)$/, '')}`,
            description: `Story exists: ${component.storyEntry?.title || 'Unknown'}`,
            selectors: [generateSelectorsForComponents([component])[0]],
          },
          {
            id: `${component.storyId}:navigate`,
            iconLeft: 'shareAlt',
            title: 'Go to story',
            clickEvent: 'storybook/navigate-to-story',
            eventData: { storyId: component.storyId },
            selectors: [generateSelectorsForComponents([component])[0]],
          },
        ]),
      });
    }

    // Highlight components without stories
    if (withoutStories.length > 0) {
      const selectorsWithoutStories = generateSelectorsForComponents(withoutStories);

      emit(HIGHLIGHT, {
        id: HIGHLIGHT_ID_WITHOUT_STORIES,
        priority: 1,
        selectors: selectorsWithoutStories,
        styles: {
          outline: '2px solid #f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
        },
        hoverStyles: {
          outline: '2px solid #d97706',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
        },
        menu: withoutStories.map<HighlightMenuItem[]>((component) => [
          {
            id: `${component.componentPath}:info`,
            title: `Component: ${component.componentPath
              .split('/')
              .pop()
              ?.replace(/\.(tsx?|jsx?)$/, '')}`,
            description: 'No story exists yet',
            selectors: [generateSelectorsForComponents([component])[0]],
          },
          {
            id: `${component.componentPath}:create`,
            iconLeft: 'plus',
            title: 'Create story',
            clickEvent: EVENTS.CREATE_STORY_FOR_COMPONENT,
            eventData: { componentPath: component.componentPath },
            selectors: [generateSelectorsForComponents([component])[0]],
          },
        ]),
      });
    }
  }, [isEnabled, components, emit]);

  // Scan components when inspector is enabled or index changes
  useEffect(() => {
    if (isEnabled) {
      scanComponents();
    }
  }, [isEnabled, scanComponents]);

  // Update highlights when components or enabled state changes
  useEffect(() => {
    updateHighlights();
  }, [updateHighlights]);

  // Clean up highlights when component unmounts
  useEffect(() => {
    return () => {
      emit(REMOVE_HIGHLIGHT, HIGHLIGHT_ID_WITH_STORIES);
      emit(REMOVE_HIGHLIGHT, HIGHLIGHT_ID_WITHOUT_STORIES);
    };
  }, [emit]);

  return {
    isEnabled,
    toggleInspector,
    createStoryForComponent,
    components: groupComponentsByStoryStatus(components),
  };
}
