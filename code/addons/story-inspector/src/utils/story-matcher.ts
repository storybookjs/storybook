import type { IndexEntry, StoryIndex } from 'storybook/internal/types';

import { COMPONENT_PATH_ATTRIBUTE } from '../constants';

export interface ComponentInfo {
  element: Element;
  componentPath: string;
  hasStory: boolean;
  storyEntry?: IndexEntry;
  storyId?: string;
}

/** Find all components in the DOM that have component path metadata */
export function findComponentsInDOM(): ComponentInfo[] {
  const elements = document.querySelectorAll(`[${COMPONENT_PATH_ATTRIBUTE}]`);
  const components: ComponentInfo[] = [];

  elements.forEach((element) => {
    const componentPath = element.getAttribute(COMPONENT_PATH_ATTRIBUTE);
    if (componentPath) {
      components.push({
        element,
        componentPath,
        hasStory: false, // Will be determined by checkComponentsAgainstIndex
      });
    }
  });

  return components;
}

/** Check components against the story index to determine which have stories */
export function checkComponentsAgainstIndex(
  components: ComponentInfo[],
  storyIndex: StoryIndex
): ComponentInfo[] {
  const entries = storyIndex.entries || {};

  return components.map((component) => {
    // Find matching story entries by comparing rawComponentPath
    const matchingEntry = Object.values(entries).find((entry) => {
      // Normalize paths for comparison
      const entryPath = entry.rawComponentPath?.replace(/\\/g, '/');
      const componentPath = component.componentPath.replace(/\\/g, '/');
      return entryPath === componentPath;
    });

    if (matchingEntry) {
      return {
        ...component,
        hasStory: true,
        storyEntry: matchingEntry,
        storyId: matchingEntry.id,
      };
    }

    return component;
  });
}

/** Group components by their story status */
export function groupComponentsByStoryStatus(components: ComponentInfo[]) {
  const withStories = components.filter((c) => c.hasStory);
  const withoutStories = components.filter((c) => !c.hasStory);

  return { withStories, withoutStories };
}

/** Generate CSS selectors for highlighting components */
export function generateSelectorsForComponents(components: ComponentInfo[]): string[] {
  return components.map((component) => {
    // Generate a unique selector for the element
    const tagName = component.element.tagName.toLowerCase();
    const componentPath = component.componentPath;
    return `${tagName}[${COMPONENT_PATH_ATTRIBUTE}="${componentPath}"]`;
  });
}
