import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { playwrightProblem } from './sandbox-image.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('playwrightProblem', () => {
  it('accepts an image built for the installed Playwright', () => {
    expect(playwrightProblem('sb-ecosystem-qa', '1.58.2', '1.58.2')).toBeUndefined();
  });

  it('names both versions when the image has another Playwright', () => {
    expect(playwrightProblem('sb-ecosystem-qa', '1.57.0', '1.58.2')).toBe(
      'The image sb-ecosystem-qa has Playwright 1.57.0, and ecosystem-qa has Playwright 1.58.2. Build the image again as ecosystem-qa/README.md says.'
    );
  });

  it('names the missing label and the installed version when the image has no label', () => {
    expect(playwrightProblem('sb-ecosystem-qa', undefined, '1.58.2')).toBe(
      'The image sb-ecosystem-qa has no org.js.storybook.ecosystem-qa.playwright label, and ecosystem-qa has Playwright 1.58.2. Build the image again as ecosystem-qa/README.md says.'
    );
  });
});

describe('Dockerfile', () => {
  it('builds for the Playwright that package.json pins', () => {
    const pin = JSON.parse(read('../package.json')).dependencies.playwright;
    const [, buildArg] = read('../Dockerfile').match(/^ARG PLAYWRIGHT_VERSION=(\S+)$/m) ?? [];
    expect(buildArg).toBe(pin);
  });
});
