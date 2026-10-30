import type { StorybookAddon } from '@storybook/core';
import type { StorybookFeatures } from '@storybook/core/internal/types';

import measure from './measure/node.ts';
import backgrounds from './backgrounds/node.ts';
import highlight from './highlight/node.ts';
import outline from './outline/node.ts';
import viewport from './viewport/node.ts';
import actions from './actions/node.ts';
import componentTesting from './component-testing/node.ts';
import componentsManifest from './components-manifest/node.ts';
import test from '@storybook/core/internal/deep/test/node';
import ghostStories from '@storybook/core/internal/deep/story-index/ghost-stories/node';
import docgen from '@storybook/core/internal/deep/shared/open-service/services/docgen/node';
import storyDocs from '@storybook/core/internal/deep/shared/open-service/services/story-docs/node';
import controls from './controls/node.ts';
import review from './review/node.ts';
import changeDetection from '@storybook/core/internal/deep/services/change-detection/node';
import toolbar from './toolbar/node.ts';
import checklist from './checklist/node.ts';
import whatsNew from './whats-new/node.ts';
import openInEditor from './open-in-editor/node.ts';
import { packageEntry } from './entries.ts';

/** Defaults of the flags `storybook` owns; core owns the rest. */
export const FEATURE_DEFAULTS = {
  actions: true,
  backgrounds: true,
  componentsManifest: false,
  controls: true,
  disallowImplicitActionsInRenderV8: true,
  highlight: true,
  interactions: true,
  measure: true,
  menuOnboardingChecklist: true,
  outline: true,
  sidebarOnboardingChecklist: true,
  viewport: true,
} satisfies StorybookFeatures;

/** The flag that shows each built-in's manager entry; preview annotations and server hooks stay. */
const MANAGER_FLAGS: Record<string, keyof StorybookFeatures> = {
  'storybook/actions': 'actions',
  'storybook/backgrounds': 'backgrounds',
  'storybook/component-testing': 'interactions',
  'storybook/controls': 'controls',
  'storybook/measure': 'measure',
  'storybook/outline': 'outline',
  'storybook/viewport': 'viewport',
};

/** Built-in addons in setup order; their preview annotations compose in this order. */
export const builtInAddons = [
  measure(),
  backgrounds(),
  highlight(),
  outline(),
  viewport(),
  actions(),
  componentTesting(),
  test({ preview: packageEntry('@storybook/core', 'test/preview.js') }),
  ghostStories({
    preview: packageEntry('@storybook/core', 'story-index/ghost-stories/test-annotations.js'),
  }),
  docgen({
    manager: packageEntry('@storybook/manager', 'shared/open-service/services/docgen/manager.js'),
    preview: packageEntry('@storybook/core', 'shared/open-service/services/docgen/preview.js'),
  }),
  review(),
  storyDocs({
    preview: packageEntry('@storybook/core', 'shared/open-service/services/story-docs/preview.js'),
  }),
  controls(),
  toolbar(),
  componentsManifest(),
  changeDetection(),
  checklist(),
  whatsNew(),
  openInEditor(),
] as const;

/** Ship an addon's manager entry unless it is a built-in whose resolved flag is not `true`. */
export function isManagerEnabled(addon: StorybookAddon, features: StorybookFeatures): boolean {
  const flag = MANAGER_FLAGS[addon.meta.name];
  return !flag || features[flag] === true;
}
