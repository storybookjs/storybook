/**
 * npm below this version silently ignores `NPM_CONFIG_MIN_RELEASE_AGE`. 11.17+ is required for
 * `min-release-age-exclude`, which templates with `minAgeGateExemptions` rely on during npx/npm
 * scaffolds. Lives in its own module so the CI config generator can read
 * it under plain Node, where `constants.ts`'s `__dirname` is undefined.
 */
export const BEFORE_SANDBOX_NPM_MIN_VERSION = '11.17.0';
