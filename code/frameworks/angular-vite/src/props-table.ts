import { logger } from 'storybook/internal/node-logger';

import type { PropsTableMode } from '@storybook/angular-cm';
import type { FrameworkOptions } from './types.ts';

export const DEFAULT_PROPS_TABLE: PropsTableMode = 'api';

interface Features {
  angularFilterNonInputControls?: boolean;
  experimentalDocgenServer?: boolean;
}

export interface PropsTableResolution {
  mode: PropsTableMode;
  /** Whether `propsTable` was set outright, as opposed to inherited from the deprecated flag. */
  configured: boolean;
  deprecatedFlag: boolean | undefined;
  docgenServer: boolean;
}

/**
 * Resolves the one switch that decides which members the props table renders.
 *
 * `angularFilterNonInputControls` is the deprecated spelling of the two outer rungs of the same
 * ladder, so it maps onto a mode rather than surviving as a second switch that could disagree.
 */
export const resolvePropsTable = (
  frameworkOptions: Pick<FrameworkOptions, 'propsTable'> | null | undefined,
  features: Features | undefined
): PropsTableResolution => {
  const configured = frameworkOptions?.propsTable;
  const deprecatedFlag = features?.angularFilterNonInputControls;
  const inherited = deprecatedFlag === undefined ? undefined : deprecatedFlag ? 'inputs' : 'all';

  return {
    mode: configured ?? inherited ?? DEFAULT_PROPS_TABLE,
    configured: configured !== undefined,
    deprecatedFlag,
    docgenServer: features?.experimentalDocgenServer === true,
  };
};

/**
 * Reports every props-table setting that will not do what it says.
 *
 * Call this from a hook that runs whatever the feature flags say: the docgen preset is skipped
 * entirely when `experimentalDocgenServer` is off, which is exactly the case one of these warnings
 * is about.
 */
export const warnAboutPropsTable = ({
  mode,
  configured,
  deprecatedFlag,
  docgenServer,
}: PropsTableResolution): void => {
  if (deprecatedFlag !== undefined) {
    logger.warn(
      `The \`angularFilterNonInputControls\` feature is deprecated and will be removed in Storybook 11. ` +
        (configured
          ? `The \`propsTable: '${mode}'\` framework option takes precedence over it, so the feature has no effect and can be removed.`
          : `Replace it with the \`propsTable: '${mode}'\` option on your \`@storybook/angular-vite\` framework.`)
    );
  }

  if (configured && mode === 'api' && !docgenServer) {
    logger.warn(
      `\`propsTable: 'api'\` needs the \`experimentalDocgenServer\` feature, which is off, so the props table keeps showing every member. ` +
        `Enable it with \`features: { experimentalDocgenServer: true }\`, or set \`propsTable: 'all'\` to say you want every member.`
    );
  }
};
