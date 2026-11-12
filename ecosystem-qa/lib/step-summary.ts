import { appendFileSync } from 'node:fs';

import { redactSecrets } from './redact.ts';

export const writeStepSummary = (markdown: string) => {
  const safe = redactSecrets(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${safe}\n`);
  } else {
    console.log(safe);
  }
};
