/**
 * Mocked review-page data for the prototype stories.
 *
 * Story IDs are real IDs from this dogfood Storybook so the prototype's
 * iframe previews actually render. The cluster shapes mirror the real
 * eval output from `exp-I5-medium-depth.jsonl` (medium scenario, 1,025
 * stories → 5 depth-tiered clusters + catch-all).
 *
 * The "story count" per cluster is inflated to match the real cascade,
 * but the displayed/iframe-rendered IDs are a small representative
 * subset (3-5 per cluster) so the page doesn't take 1,000 iframes to
 * render.
 */

export type StoryStatus = 'new' | 'modified' | 'related';

export interface MockStory {
  storyId: string;
  status: StoryStatus;
  title: string;
  name: string;
  importPath: string;
  /** Depth (number of import hops from the changed file). */
  depth?: number;
  /**
   * Hint for the focused-review prototype: 'component' fits a 320×180
   * thumbnail, 'page' needs full viewport width to be readable.
   * Inferred from the story id/title in the real implementation.
   */
  size?: 'component' | 'page';
}

export interface MockCluster {
  id: string;
  /** One-sentence rationale from the categoriser. */
  rationale: string;
  /** "Representative" story — the most illustrative one in the cluster. */
  representative: string;
  /** Total story count this cluster represents in the real cascade. */
  totalStoryCount: number;
  /** Sample of real story IDs in this cluster (≤6 for the prototype). */
  sampleStories: MockStory[];
  /** Depth tier (when the cluster is depth-aligned). */
  depthHint?: number;
}

export interface MockReviewData {
  changedFile: string;
  diffSummary: string;
  cascadeSize: number;
  modifiedCount: number;
  newCount: number;
  relatedCount: number;
  stories: MockStory[];
  clusters: MockCluster[];
}

// ──────────────────────────────────────────────────────────────────
// The mock cascade. Inspired by the real medium-scenario eval (a
// 1-line Button.tsx edit causing ~1,025 stories to flag). Story IDs
// below are real and resolve in the dogfood UI.
// ──────────────────────────────────────────────────────────────────

const directButtonImporters: MockStory[] = [
  {
    storyId: 'button-component--base',
    status: 'modified',
    title: 'button/component',
    name: 'Base',
    importPath: './core/src/components/components/Button/Button.stories.tsx',
    depth: 1,
  },
  {
    storyId: 'button-component--variants',
    status: 'modified',
    title: 'button/component',
    name: 'Variants',
    importPath: './core/src/components/components/Button/Button.stories.tsx',
    depth: 1,
  },
  {
    storyId: 'button-component--sizes',
    status: 'modified',
    title: 'button/component',
    name: 'Sizes',
    importPath: './core/src/components/components/Button/Button.stories.tsx',
    depth: 1,
  },
  {
    storyId: 'button-component--with-icon',
    status: 'modified',
    title: 'button/component',
    name: 'WithIcon',
    importPath: './core/src/components/components/Button/Button.stories.tsx',
    depth: 1,
  },
];

const overlayConsumers: MockStory[] = [
  {
    storyId: 'overlay-modal--base',
    status: 'related',
    title: 'overlay/Modal',
    name: 'Base',
    importPath: './core/src/components/components/Modal/Modal.stories.tsx',
    depth: 2,
  },
  {
    storyId: 'overlay-popover--as-popover',
    status: 'related',
    title: 'overlay/Popover',
    name: 'AsPopover',
    importPath: './core/src/components/components/Popover/Popover.stories.tsx',
    depth: 2,
  },
  {
    storyId: 'overlay-tooltip--base',
    status: 'related',
    title: 'overlay/Tooltip',
    name: 'Base',
    importPath: './core/src/components/components/Tooltip/Tooltip.stories.tsx',
    depth: 2,
  },
];

const selectAndTabsConsumers: MockStory[] = [
  {
    storyId: 'select-component--base',
    status: 'related',
    title: 'select/component',
    name: 'Base',
    importPath: './core/src/components/components/Select/Select.stories.tsx',
    depth: 2,
  },
  {
    storyId: 'components-tabs--stateful-static',
    status: 'related',
    title: 'components/Tabs',
    name: 'StatefulStatic',
    importPath: './core/src/components/components/Tabs/Tabs.stories.tsx',
    depth: 2,
  },
  {
    storyId: 'components-toolbar--basic',
    status: 'related',
    title: 'components/Toolbar',
    name: 'Basic',
    importPath: './core/src/components/components/Toolbar/Toolbar.stories.tsx',
    depth: 2,
  },
];

const docsConsumers: MockStory[] = [
  {
    storyId: 'addons-docs-blocks-blocks-source--code',
    status: 'modified',
    title: 'addons/docs/blocks/blocks/Source',
    name: 'Code',
    importPath: './addons/docs/src/blocks/blocks/Source.stories.tsx',
    depth: 1,
  },
  {
    storyId: 'addons-docs-blocks-components-preview--code-collapsed',
    status: 'modified',
    title: 'addons/docs/blocks/components/Preview',
    name: 'CodeCollapsed',
    importPath: './addons/docs/src/blocks/components/Preview.stories.tsx',
    depth: 1,
  },
];

const managerConsumers: MockStory[] = [
  {
    storyId: 'manager-sidebar-sidebar--simple',
    status: 'related',
    title: 'manager/sidebar/Sidebar',
    name: 'Simple',
    importPath: './core/src/manager/components/sidebar/Sidebar.stories.tsx',
    depth: 3,
  },
  {
    storyId: 'manager-sidebar-search--simple',
    status: 'related',
    title: 'manager/sidebar/Search',
    name: 'Simple',
    importPath: './core/src/manager/components/sidebar/Search.stories.tsx',
    depth: 3,
  },
  {
    storyId: 'manager-mobile-navigation--default',
    status: 'related',
    title: 'manager/mobile/Navigation',
    name: 'Default',
    importPath: './core/src/manager/components/mobile/Navigation.stories.tsx',
    depth: 3,
  },
];

const remainingConsumers: MockStory[] = [
  {
    storyId: 'addons-accessibility-panel--ready-with-results',
    status: 'related',
    title: 'addons/accessibility/Panel',
    name: 'ReadyWithResults',
    importPath: './addons/a11y/src/components/Panel.stories.tsx',
    depth: 4,
  },
  {
    storyId: 'addons-onboarding-features-splashscreen--default',
    status: 'related',
    title: 'addons/onboarding/features/Splashscreen',
    name: 'Default',
    importPath: './addons/onboarding/src/features/WelcomeTour/Splashscreen.stories.tsx',
    depth: 4,
  },
];

export const mockReviewData: MockReviewData = {
  changedFile: 'code/core/src/components/components/Button/Button.tsx',
  diffSummary: 'Added an inline comment marker; no behavioural change.',
  cascadeSize: 1025,
  modifiedCount: 210,
  newCount: 0,
  relatedCount: 815,
  stories: [
    ...directButtonImporters,
    ...docsConsumers,
    ...overlayConsumers,
    ...selectAndTabsConsumers,
    ...managerConsumers,
    ...remainingConsumers,
  ],
  clusters: [
    {
      id: 'direct-button-importers',
      rationale:
        'Depth-1 stories whose story files directly import Button.tsx. Highest review priority — these will render the latest Button code first.',
      representative: 'button-component--base',
      totalStoryCount: 32,
      depthHint: 1,
      sampleStories: directButtonImporters,
    },
    {
      id: 'docs-blocks-direct',
      rationale:
        'Depth-1 stories in the docs-blocks Source/Preview components that directly import Button as part of the block rendering surface.',
      representative: 'addons-docs-blocks-blocks-source--code',
      totalStoryCount: 18,
      depthHint: 1,
      sampleStories: docsConsumers,
    },
    {
      id: 'overlay-consumers',
      rationale:
        'Depth-2 stories for Modal, Popover, and Tooltip — overlay primitives that compose Button into their footer/header actions.',
      representative: 'overlay-modal--base',
      totalStoryCount: 47,
      depthHint: 2,
      sampleStories: overlayConsumers,
    },
    {
      id: 'select-tabs-toolbar',
      rationale:
        'Depth-2 stories for Select, Tabs, and Toolbar — interactive primitives that consume Button as their atomic interactive element.',
      representative: 'select-component--base',
      totalStoryCount: 64,
      depthHint: 2,
      sampleStories: selectAndTabsConsumers,
    },
    {
      id: 'manager-transitive',
      rationale:
        'Depth-3 manager-namespace stories (sidebar, mobile, notifications, settings) that consume Button via the components-library layer.',
      representative: 'manager-sidebar-sidebar--simple',
      totalStoryCount: 412,
      depthHint: 3,
      sampleStories: managerConsumers,
    },
    {
      id: 'remaining-consumers',
      rationale:
        'Catch-all for addons (accessibility, onboarding, vitest) and other distant consumers. Visual impact of the Button comment-only diff is unlikely here.',
      representative: 'addons-accessibility-panel--ready-with-results',
      totalStoryCount: 452,
      sampleStories: remainingConsumers,
    },
  ],
};

// ──────────────────────────────────────────────────────────────────
// Mock data for the FocusedReview (page-level) prototype.
//
// Curated set that mixes component-scale and page-level stories — the
// problem the focused prototype is designed to solve. Each story has a
// `size` hint so the prototype can render component stories at a
// constrained width and page-level stories full-bleed.
// ──────────────────────────────────────────────────────────────────

export const mixedSizeStories: MockStory[] = [
  // Component-scale (would render fine in any prototype)
  {
    storyId: 'button-component--base',
    status: 'modified',
    title: 'button/component',
    name: 'Base',
    importPath: './core/src/components/components/Button/Button.stories.tsx',
    depth: 1,
    size: 'component',
  },
  {
    storyId: 'overlay-modal--base',
    status: 'related',
    title: 'overlay/Modal',
    name: 'Base',
    importPath: './core/src/components/components/Modal/Modal.stories.tsx',
    depth: 2,
    size: 'component',
  },
  // Layout-scale — start to push against the card size
  {
    storyId: 'manager-sidebar-sidebar--simple',
    status: 'modified',
    title: 'manager/sidebar/Sidebar',
    name: 'Simple',
    importPath: './core/src/manager/components/sidebar/Sidebar.stories.tsx',
    depth: 3,
    size: 'page',
  },
  {
    storyId: 'manager-sidebar-sidebar--with-refs',
    status: 'related',
    title: 'manager/sidebar/Sidebar',
    name: 'WithRefs',
    importPath: './core/src/manager/components/sidebar/Sidebar.stories.tsx',
    depth: 3,
    size: 'page',
  },
  // Full-page stories — the cases where the card-grid layout breaks down
  {
    storyId: 'manager-main--default',
    status: 'related',
    title: 'manager/Main',
    name: 'Default',
    importPath: './core/src/manager/components/main/Main.stories.tsx',
    depth: 4,
    size: 'page',
  },
  {
    storyId: 'manager-main--full-screen',
    status: 'related',
    title: 'manager/Main',
    name: 'FullScreen',
    importPath: './core/src/manager/components/main/Main.stories.tsx',
    depth: 4,
    size: 'page',
  },
  {
    storyId: 'manager-layout--desktop',
    status: 'related',
    title: 'manager/Layout',
    name: 'Desktop',
    importPath: './core/src/manager/components/layout/Layout.stories.tsx',
    depth: 4,
    size: 'page',
  },
  {
    storyId: 'manager-layout--mobile',
    status: 'related',
    title: 'manager/Layout',
    name: 'Mobile',
    importPath: './core/src/manager/components/layout/Layout.stories.tsx',
    depth: 4,
    size: 'page',
  },
  {
    storyId: 'addons-onboarding-features-splashscreen--default',
    status: 'modified',
    title: 'addons/onboarding/features/Splashscreen',
    name: 'Default',
    importPath: './addons/onboarding/src/features/WelcomeTour/Splashscreen.stories.tsx',
    depth: 4,
    size: 'page',
  },
  {
    storyId: 'addons-onboarding-features-intentsurvey--default',
    status: 'related',
    title: 'addons/onboarding/features/IntentSurvey',
    name: 'Default',
    importPath: './addons/onboarding/src/features/WelcomeTour/IntentSurvey.stories.tsx',
    depth: 4,
    size: 'page',
  },
];

export const mockMixedSizeData: MockReviewData = {
  changedFile: 'code/core/src/components/components/Button/Button.tsx',
  diffSummary: 'Added an inline comment marker; no behavioural change.',
  cascadeSize: 1025,
  modifiedCount: 210,
  newCount: 0,
  relatedCount: 815,
  stories: mixedSizeStories,
  clusters: [
    {
      id: 'direct-button-importers',
      rationale:
        'Depth-1 stories whose story files directly import Button.tsx. Highest review priority.',
      representative: 'button-component--base',
      totalStoryCount: 32,
      depthHint: 1,
      sampleStories: mixedSizeStories.slice(0, 2),
    },
    {
      id: 'manager-layout-pages',
      rationale:
        'Manager-namespace page-level stories. These render the full Storybook UI shell and will not fit in card-grid thumbnails — review one at a time.',
      representative: 'manager-main--default',
      totalStoryCount: 23,
      depthHint: 4,
      sampleStories: mixedSizeStories.slice(2, 8),
    },
    {
      id: 'onboarding-pages',
      rationale:
        'Full-viewport onboarding screens. Inherently page-level — these will look broken in a tiny card preview.',
      representative: 'addons-onboarding-features-splashscreen--default',
      totalStoryCount: 6,
      depthHint: 4,
      sampleStories: mixedSizeStories.slice(8, 10),
    },
  ],
};

export const statusLabel: Record<StoryStatus, string> = {
  new: 'New',
  modified: 'Modified',
  related: 'Related',
};

export const statusColors: Record<StoryStatus, { fg: string; bg: string }> = {
  new: { fg: '#15803d', bg: '#dcfce7' },
  modified: { fg: '#1d4ed8', bg: '#dbeafe' },
  related: { fg: '#64748b', bg: '#f1f5f9' },
};
