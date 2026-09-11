import { SupportedBuilder } from 'storybook/internal/types';

import semver from 'semver';
import { dedent } from 'ts-dedent';

/** Range required by webpack's schema-utils → ajv-keywords@5 (`ajv/dist/compile/codegen`). */
export const WEBPACK5_AJV_RANGE = '^8.17.1';
export const WEBPACK5_AJV_PACKAGE = `ajv@${WEBPACK5_AJV_RANGE}`;

/**
 * Decide whether Webpack 5 Storybook init should install ajv@8.
 *
 * - No direct `ajv`: install a compatible range.
 * - Direct `ajv` already compatible with ^8: leave the user's range alone.
 * - Direct `ajv` incompatible (e.g. ^6): fail with an actionable message — never overwrite.
 *
 * @see https://github.com/storybookjs/storybook/issues/36176
 */
export function resolveWebpack5AjvPackageToInstall({
  builder,
  declaredAjvRange,
}: {
  builder: SupportedBuilder;
  declaredAjvRange: string | undefined;
}): string | null {
  if (builder !== SupportedBuilder.WEBPACK5) {
    return null;
  }

  if (!declaredAjvRange) {
    return WEBPACK5_AJV_PACKAGE;
  }

  const range = declaredAjvRange.trim();
  if (semver.validRange(range) && semver.intersects(range, WEBPACK5_AJV_RANGE)) {
    return null;
  }

  throw new Error(dedent`
    Webpack 5 Storybook requires ajv@${WEBPACK5_AJV_RANGE} because webpack's schema-utils →
    ajv-keywords needs \`ajv/dist/compile/codegen\`, but this project already declares a direct
    dependency on ajv@${declaredAjvRange}.

    Storybook will not overwrite that range. Please upgrade the direct \`ajv\` dependency to
    ${WEBPACK5_AJV_RANGE} (or remove it so Storybook can install a compatible version), then
    re-run the initializer.

    See: https://github.com/storybookjs/storybook/issues/36176
  `);
}
