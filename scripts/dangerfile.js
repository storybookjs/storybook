/**
 * IMPORTANT: This file has unique constraints due to how Danger.js executes it.
 *
 * Restrictions:
 *
 * - NO TypeScript: This file runs without any transpilation/transformation
 * - NO external dependencies: Scripts dependencies are not installed in CI
 * - NO Node.js built-ins: Even `fs` and other core modules don't work in Danger's runtime
 * - MUST use `import` for Danger API: The Danger runtime only processes `import` statements, not
 *   `require()`. These imports get compiled to global references by Danger.js
 * - CAN use `require()` for local files: Works for things like package.json
 *
 * Why: We want Danger to run as fast as possible in CI without installing dependencies or running
 * build processes.
 */
import { danger, fail } from 'danger';

/**
 * Returns the intersection of two arrays
 *
 * @template T
 * @param {ReadonlyArray<T>} a - First array
 * @param {ReadonlyArray<T>} b - Second array
 * @returns {T[]} Array containing elements present in both arrays
 */
function intersection(a, b) {
  return a.filter((v) => b.includes(v));
}

const pkg = require('../code/package.json');

const Versions = {
  PATCH: 'PATCH',
  MINOR: 'MINOR',
  MAJOR: 'MAJOR',
};

const ciLabels = ['ci:normal', 'ci:merged', 'ci:daily', 'ci:docs'];

const { labels } = danger.github.issue;

const prLogConfig = pkg['pr-log'];

const branchVersion = Versions.MINOR;

/** @param {string[]} labels */
const checkRequiredLabels = (labels) => {
  const forbiddenLabels = [
    'ci: do not merge',
    'in progress',
    ...(branchVersion !== Versions.MAJOR ? ['BREAKING CHANGE'] : []),
    ...(branchVersion === Versions.PATCH ? ['feature request'] : []),
  ];

  const requiredLabels = [
    ...(prLogConfig?.skipLabels ?? []),
    ...(prLogConfig?.validLabels ?? []).map(([label]) => label),
  ];

  const blockingLabels = intersection(forbiddenLabels, labels);
  if (blockingLabels.length > 0) {
    fail(
      `PR is marked with ${blockingLabels.map((label) => `"${label}"`).join(', ')} label${
        blockingLabels.length > 1 ? 's' : ''
      }.`
    );
  }

  const foundRequiredLabels = intersection(requiredLabels, labels);
  if (foundRequiredLabels.length === 0) {
    fail(`PR is not labeled with one of: ${JSON.stringify(requiredLabels)}`);
  } else if (foundRequiredLabels.length > 1) {
    fail(`Please choose only one of these labels: ${JSON.stringify(foundRequiredLabels)}`);
  }

  const foundCILabels = intersection(ciLabels, labels);
  if (foundCILabels.length === 0) {
    fail(`PR is not labeled with one of: ${JSON.stringify(ciLabels)}`);
  } else if (foundCILabels.length > 1) {
    fail(`Please choose only one of these labels: ${JSON.stringify(foundCILabels)}`);
  }
};

/** @param {string} title */
const checkPrTitle = (title) => {
  const match = title.match(/^[A-Z].+:\s[A-Z].+$/);
  if (!match) {
    fail(
      `PR title must be in the format of "Area: Summary", With both Area and Summary starting with a capital letter
Good examples:
- "Docs: Describe Canvas Doc Block"
- "Svelte: Support Svelte v4"
Bad examples:
- "add new api docs"
- "fix: Svelte 4 support"
- "Vue: improve docs"`
    );
  }
};

if (prLogConfig) {
  checkRequiredLabels(labels.map((l) => l.name));
  checkPrTitle(danger.github.pr.title);
}
