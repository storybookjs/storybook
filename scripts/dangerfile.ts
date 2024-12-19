/* eslint-disable import/no-extraneous-dependencies, import/extensions */
import { execSync } from 'child_process';
import { danger, fail } from 'danger';

execSync('npm install lodash');

// eslint-disable-next-line depend/ban-dependencies
const flatten = require('lodash/flatten.js');
// eslint-disable-next-line depend/ban-dependencies
const intersection = require('lodash/intersection.js');
// eslint-disable-next-line depend/ban-dependencies
const isEmpty = require('lodash/isEmpty.js');

const pkg = require('../code/package.json');
const prLogConfig = pkg['pr-log'];

const Versions = {
  PATCH: 'PATCH',
  MINOR: 'MINOR',
  MAJOR: 'MAJOR',
};

const ciLabels = ['ci:normal', 'ci:merged', 'ci:daily', 'ci:docs'];

const branchVersion = Versions.MINOR;

const checkRequiredLabels = (labels: string[]) => {
  const forbiddenLabels = flatten([
    'ci: do not merge',
    'in progress',
    branchVersion !== Versions.MAJOR ? 'BREAKING CHANGE' : [],
    branchVersion === Versions.PATCH ? 'feature request' : [],
  ]);

  const requiredLabels = flatten([
    prLogConfig.skipLabels || [],
    (prLogConfig.validLabels || []).map((keyVal: string) => keyVal[0]),
  ]);

  const blockingLabels = intersection(forbiddenLabels, labels);
  if (!isEmpty(blockingLabels)) {
    fail(
      `PR is marked with ${blockingLabels.map((label: string) => `"${label}"`).join(', ')} label${
        blockingLabels.length > 1 ? 's' : ''
      }.`
    );
  }

  const foundRequiredLabels = intersection(requiredLabels, labels);
  if (isEmpty(foundRequiredLabels)) {
    fail(`PR is not labeled with one of: ${JSON.stringify(requiredLabels)}`);
  } else if (foundRequiredLabels.length > 1) {
    fail(`Please choose only one of these labels: ${JSON.stringify(foundRequiredLabels)}`);
  }

  const foundCILabels = intersection(ciLabels, labels);
  if (isEmpty(foundCILabels)) {
    fail(`PR is not labeled with one of: ${JSON.stringify(ciLabels)}`);
  } else if (foundCILabels.length > 1) {
    fail(`Please choose only one of these labels: ${JSON.stringify(foundCILabels)}`);
  }
};

const checkPrTitle = (title: string) => {
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
  const { labels } = danger.github.issue;
  checkRequiredLabels(labels.map((l) => l.name));
  checkPrTitle(danger.github.pr.title);
}
