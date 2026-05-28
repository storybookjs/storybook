import type { ReviewCollection } from './review-state.ts';

export interface ComponentGroup {
  componentId: string;
  storyIds: string[];
}

// Every story referenced by the review, grouped by component. The component
// id is the story id prefix (everything before `--`) — exactly how Storybook
// itself groups stories under a component. A story that appears in multiple
// collections is listed once; component order follows first appearance.
export const groupStoriesByComponent = (collections: ReviewCollection[]): ComponentGroup[] => {
  const order: string[] = [];
  const storiesByComponent = new Map<string, string[]>();

  for (const collection of collections) {
    for (const storyId of collection.storyIds) {
      const componentId = storyId.split('--')[0];
      let stories = storiesByComponent.get(componentId);
      if (!stories) {
        stories = [];
        storiesByComponent.set(componentId, stories);
        order.push(componentId);
      }
      if (!stories.includes(storyId)) {
        stories.push(storyId);
      }
    }
  }

  return order.map((componentId) => ({
    componentId,
    storyIds: storiesByComponent.get(componentId) ?? [],
  }));
};

// Fallback display name when the Storybook index has not resolved a title.
export const prettifyComponentId = (componentId: string) =>
  componentId
    .split(/[-/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
