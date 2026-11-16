import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { z } from 'zod';

const PLAYWRIGHT_LABEL = 'org.js.storybook.ecosystem-qa.playwright';

const Labels = z.record(z.string(), z.string()).nullable();

// A Playwright of another version than the image's finds no browser in it.
export const playwrightProblem = (
  image: string,
  label: string | undefined,
  installed: string
): string | undefined => {
  if (label === installed) {
    return undefined;
  }
  const built =
    label === undefined ? `has no ${PLAYWRIGHT_LABEL} label` : `has Playwright ${label}`;
  return `The image ${image} ${built}, and ecosystem-qa has Playwright ${installed}. Build the image again as ecosystem-qa/README.md says.`;
};

export const sandboxImageProblem = (image: string): string | undefined => {
  const inspect = spawnSync(
    'docker',
    ['image', 'inspect', '--format', '{{json .Config.Labels}}', image],
    { encoding: 'utf8' }
  );
  if (inspect.status !== 0) {
    const reason = inspect.stderr?.trim() || String(inspect.error);
    return `Docker cannot read the image ${image} (${reason}). Build it as ecosystem-qa/README.md says.`;
  }
  const labels = Labels.parse(JSON.parse(inspect.stdout));
  const installed: string = createRequire(import.meta.url)('playwright/package.json').version;
  return playwrightProblem(image, labels?.[PLAYWRIGHT_LABEL], installed);
};
