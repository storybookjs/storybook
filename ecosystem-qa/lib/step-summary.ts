import { appendFileSync } from 'node:fs';

/** Append Markdown to the GitHub Actions Step Summary, or print it outside Actions. */
export const writeStepSummary = (markdown: string) => {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  } else {
    console.log(markdown);
  }
};
