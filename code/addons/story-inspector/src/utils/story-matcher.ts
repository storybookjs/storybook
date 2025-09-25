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
  // Find the preview iframe - this is where the actual stories are rendered
  const previewIframe = document.getElementById('storybook-preview-iframe') as HTMLIFrameElement;

  if (!previewIframe) {
    console.warn('Story Inspector: Preview iframe not found');
    return [];
  }

  // Check if iframe is loaded and accessible
  let previewDocument: Document;
  try {
    previewDocument = previewIframe.contentDocument || previewIframe.contentWindow?.document;
    if (!previewDocument) {
      console.warn('Story Inspector: Could not access preview iframe document');
      return [];
    }
  } catch (error) {
    // Handle cross-origin restrictions
    console.warn('Story Inspector: Cannot access iframe document (possibly cross-origin):', error);
    return [];
  }

  // Query within the iframe's document, not the manager's document
  const elements = previewDocument.querySelectorAll(`[${COMPONENT_PATH_ATTRIBUTE}]`);
  const componentMap = new Map<string, ComponentInfo>();

  elements.forEach((element) => {
    const componentPath = element.getAttribute(COMPONENT_PATH_ATTRIBUTE);
    if (componentPath) {
      // Deduplicate: only keep one entry per component path
      // Use the first element found for each unique component path
      if (!componentMap.has(componentPath)) {
        componentMap.set(componentPath, {
          element,
          componentPath,
          hasStory: false, // Will be determined by checkComponentsAgainstIndex
        });
      }
    }
  });

  return Array.from(componentMap.values());
}

/** Check components against the story index to determine which have stories */
export function checkComponentsAgainstIndex(
  components: ComponentInfo[],
  storyIndex: StoryIndex['entries']
): ComponentInfo[] {
  const entries = storyIndex || {};

  return components.map((component) => {
    // Find matching story entries by comparing componentPath
    const matchingEntry = Object.values(entries).find((entry) => {
      // Normalize paths for comparison
      const entryPath = (entry as any).componentPath?.replace(/\\/g, '/');
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
