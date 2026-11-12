import { appendFileSync } from 'node:fs';

import { redactSecrets } from './redact.ts';

/** Append Markdown to the GitHub Actions Step Summary, or print it outside Actions. */
export const writeStepSummary = (markdown: string) => {
  const safe = redactSecrets(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${safe}\n`);
  } else {
    console.log(safe);
  }
};
