// Fallback display name when the Storybook index has not resolved a title.
export const prettifyComponentId = (componentId: string) =>
  componentId
    .split(/[-/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
