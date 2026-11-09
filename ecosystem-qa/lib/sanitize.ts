import type { Finding } from './schema.ts';

const LIMITS = { title: 150, actual: 500, expected: 300, errorText: 4000, reproStep: 300 };
const MAX_REPRO_STEPS = 12;

const ALLOWED_HOSTS = new Set(['github.com', 'raw.githubusercontent.com']);
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\/\S*/gi;

const cap = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)} [truncated]` : text;

// URL parsing resolves dot segments and percent-encoded dots before the owner is compared.
const isStorybookLink = (candidate: string): boolean => {
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    const [, owner] = url.pathname.split('/');
    return (
      url.protocol === 'https:' &&
      ALLOWED_HOSTS.has(url.hostname) &&
      owner?.toLowerCase() === 'storybookjs'
    );
  } catch {
    return false;
  }
};

/**
 * Make a line of agent prose safe for an issue title: capped, no HTML, no links off storybookjs,
 * and every mention and issue reference inside a code span.
 *
 * Backticks become quotes first, so the only code spans are the ones added here.
 */
export const sanitizeTitle = (text: string): string =>
  cap(text, LIMITS.title)
    .replaceAll('`', "'")
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, (match, label: string, url: string) =>
      isStorybookLink(url) ? match : `${label} (link removed)`
    )
    .replace(LINK, (url) => (isStorybookLink(url) ? url : '(link removed)'))
    .replace(/(^|[^\w`])(@[a-z0-9][\w.-]*(?:\/[\w.-]+)?)/gi, '$1`$2`')
    .replace(/(^|[^\w`&/])((?:[\w.-]+\/[\w.-]+)?#\d+)\b/g, '$1`$2`');

/**
 * Cap the prose fields of a finding for an issue body, where each one is rendered inside a fence.
 *
 * Only the first repro steps are kept. The title is left alone; `sanitizeTitle` owns it.
 */
export const sanitizeFinding = (finding: Finding): Finding => ({
  ...finding,
  actual: cap(finding.actual, LIMITS.actual),
  expected: cap(finding.expected, LIMITS.expected),
  errorText: finding.errorText && cap(finding.errorText, LIMITS.errorText),
  reproSteps: finding.reproSteps
    .slice(0, MAX_REPRO_STEPS)
    .map((step) => cap(step, LIMITS.reproStep)),
});
