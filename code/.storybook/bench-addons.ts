/**
 * Third-party addons used to benchmark how the manager builder bundles addons that are not part of
 * this repository. They are only added to the internal Storybook when
 * `STORYBOOK_MANAGER_BENCH_ADDONS` is set, because several of them target other Storybook versions
 * and are not expected to work in the preview.
 */
import { fileURLToPath } from 'node:url';

/** The most downloaded addons on npm that live outside this repository and ship a manager entry. */
export const popularAddons = [
  'storybook-dark-mode',
  'storybook-addon-tag-badges',
  '@vueless/storybook-dark-mode',
  'storybook-addon-remix-react-router',
  'storybook-i18n',
  'storybook-addon-rtl',
  '@github-ui/storybook-addon-performance-panel',
  'storybook-addon-mock-date',
  'storybook-addon-test-codegen',
  'storybook-addon-apollo-client',
];

/** Recently published addons. */
export const recentAddons = [
  'storybook-addon-canvas-comments',
  '@uiparity/storybook-addon',
  'mokapi-storybook-addon',
  'storybook-pdf-export',
  'storybook-addon-async-globals',
  'web-mocks-recorder/storybook/preset',
  '@rocksoliddigital/storybook-addon-lineage',
  'storybook-addon-externalsss',
  'storybook-addon-contributors',
];

/**
 * Installed but not registered: `storybook-addon-ai-chatbot` refuses to load without the widget id
 * of an account with its vendor. It only injects a script tag and has no manager entry.
 */
export const unregisteredAddons = ['storybook-addon-ai-chatbot'];

/**
 * Addons whose preset cannot be loaded by this Storybook version. Registering them as addons would
 * abort startup, so only their manager entry is bundled.
 */
export const managerOnlyAddons = ['storybook-addon-test-codegen'];

/**
 * Addons whose manager entry imports components that Storybook 11 removed from
 * `storybook/internal/components` (`IconButton`, `WithTooltip`, `TooltipMessage`,
 * `TooltipLinkList`). One such import fails the manager build, so these addons can only be bundled
 * when the benchmark declares those exports again, and they do not render.
 */
export const addonsUsingRemovedComponents = [
  'storybook-dark-mode',
  'storybook-addon-tag-badges',
  'storybook-i18n',
  'storybook-addon-rtl',
  '@github-ui/storybook-addon-performance-panel',
  'storybook-addon-mock-date',
  'storybook-addon-test-codegen',
  '@uiparity/storybook-addon',
  'mokapi-storybook-addon',
  'storybook-pdf-export',
];

/** Unset: no benchmark addons. `compatible`: only those that bundle unaided. Else: all of them. */
const selection = process.env.STORYBOOK_MANAGER_BENCH_ADDONS;

const selected = (addon: string) =>
  Boolean(selection) &&
  !(selection === 'compatible' && addonsUsingRemovedComponents.includes(addon));

export const benchAddons = [...popularAddons, ...recentAddons].filter(
  (addon) => selected(addon) && !managerOnlyAddons.includes(addon)
);

export const benchManagerEntries = managerOnlyAddons
  .filter(selected)
  .map((addon) => fileURLToPath(import.meta.resolve(`${addon}/manager`)));
