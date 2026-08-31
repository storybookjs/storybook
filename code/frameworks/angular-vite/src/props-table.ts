import { deprecate, logger } from 'storybook/internal/node-logger';
import type { StorybookFeatures } from 'storybook/internal/types';

import type { PropsTableMode } from '@storybook/angular-cm';
import type { FrameworkOptions } from './types.ts';

type PropsTableInput = Pick<FrameworkOptions, 'propsTable'> | null | undefined;
type Features =
  | Pick<StorybookFeatures, 'angularFilterNonInputControls' | 'experimentalDocgenServer'>
  | undefined;

const MODES: readonly PropsTableMode[] = ['all', 'api', 'inputs'];

// A misspelt mode arrives through untyped JS configs; carrying it onward would half-apply it, with
// each pipeline reading the junk string differently.
const configuredMode = (frameworkOptions: PropsTableInput): PropsTableMode | undefined => {
  const configured = frameworkOptions?.propsTable;
  return MODES.includes(configured as PropsTableMode) ? configured : undefined;
};

/**
 * Resolves the one switch that decides which members the props table renders.
 *
 * `angularFilterNonInputControls` is the deprecated spelling of the two outer rungs of the same
 * ladder, so it maps onto a mode rather than surviving as a second switch that could disagree.
 */
export const resolvePropsTable = (
  frameworkOptions: PropsTableInput,
  features: Features
): PropsTableMode => {
  const deprecatedFlag = features?.angularFilterNonInputControls;
  const inherited = deprecatedFlag === undefined ? undefined : deprecatedFlag ? 'inputs' : 'all';

  return configuredMode(frameworkOptions) ?? inherited ?? 'api';
};

/**
 * Reports every props-table setting that will not do what it says.
 *
 * Call this from a hook that runs whatever the feature flags say: the docgen preset is skipped
 * entirely when `experimentalDocgenServer` is off, which is exactly the case one of these warnings
 * is about.
 */
export const warnAboutPropsTable = (
  frameworkOptions: PropsTableInput,
  features: Features
): void => {
  const raw = frameworkOptions?.propsTable;
  const configured = configuredMode(frameworkOptions);
  if (raw !== undefined && configured === undefined) {
    logger.warn(
      `Ignoring the unknown \`propsTable\` value ${JSON.stringify(raw)}; expected 'all', 'api' or 'inputs'.`
    );
  }

  if (features?.angularFilterNonInputControls !== undefined) {
    const mode = resolvePropsTable(frameworkOptions, features);
    deprecate(
      `The \`angularFilterNonInputControls\` feature is deprecated and will be removed in Storybook 11. ` +
        (configured !== undefined
          ? `The \`propsTable: '${mode}'\` framework option takes precedence over it, so the feature has no effect and can be removed.`
          : `Replace it with the \`propsTable: '${mode}'\` option on your \`@storybook/angular-vite\` framework.`)
    );
  }

  if (configured === 'api' && features?.experimentalDocgenServer !== true) {
    logger.warn(
      `\`propsTable: 'api'\` needs the \`experimentalDocgenServer\` feature, which is off, so the props table keeps showing every member. ` +
        `Enable it with \`features: { experimentalDocgenServer: true }\`, or set \`propsTable: 'all'\` to say you want every member.`
    );
  }
};
