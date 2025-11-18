import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { danger, fail } from 'danger';

const intersection = (a: readonly string[], b: readonly string[]) => a.filter((v) => b.includes(v));

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf-8'));

const Versions = {
  PATCH: 'PATCH',
  MINOR: 'MINOR',
  MAJOR: 'MAJOR',
};

const ciLabels = ['ci:normal', 'ci:merged', 'ci:daily', 'ci:docs'];

const { labels } = danger.github.issue;

const prLogConfig = pkg['pr-log'];

const branchVersion = Versions.MINOR;

const checkRequiredLabels = (labels: string[]) => {
  const forbiddenLabels = [
    'ci: do not merge',
    'in progress',
    ...(branchVersion !== Versions.MAJOR ? ['BREAKING CHANGE'] : []),
    ...(branchVersion === Versions.PATCH ? ['feature request'] : []),
  ];

  const requiredLabels = [
    ...(prLogConfig?.skipLabels ?? []),
    ...(prLogConfig?.validLabels ?? []).map(([label]: [string]) => label),
  ];

  const blockingLabels = intersection(forbiddenLabels, labels);
  if (blockingLabels.length > 0) {
    fail(
      `PR is marked with ${blockingLabels.map((label: string) => `"${label}"`).join(', ')} label${
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
  checkRequiredLabels(labels.map((l) => l.name));
  checkPrTitle(danger.github.pr.title);
}
