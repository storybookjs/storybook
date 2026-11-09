import type { Finding } from './types.ts';

const LIMITS = { title: 150, actual: 500, expected: 300, errorText: 4000, reproStep: 300 };
const MAX_REPRO_STEPS = 12;
const TRUNCATED = ' [truncated]';

const ALLOWED_LINK = /^https:\/\/(?:github\.com|raw\.githubusercontent\.com)\/storybookjs\//i;

const cap = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}${TRUNCATED}` : text;

// Prose fields come from an agent that read an untrusted repository, so they are rendered as inert
// text: no HTML, no notifications, no links off storybookjs.
export const sanitizeText = (text: string): string =>
  text
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]*)\]\((\S+?)\)/g, (match, label: string, url: string) =>
      ALLOWED_LINK.test(url) ? match : `${label} (link removed)`
    )
    .replace(/https?:\/\/\S+/g, (url) => (ALLOWED_LINK.test(url) ? url : '(link removed)'))
    .replace(/(^|[^\w`])@([a-z0-9][a-z0-9-]*)/gi, '$1`@$2`')
    .replace(/(^|[^\w`&])#(\d+)\b/g, '$1`#$2`');

// errorText is only capped: it is always rendered inside a fence, where markdown stays literal, and
// stripping angle brackets would mangle type names in real errors.
export const sanitizeFinding = (finding: Finding): Finding => {
  const steps = finding.reproSteps
    .slice(0, MAX_REPRO_STEPS)
    .map((step) => cap(sanitizeText(step), LIMITS.reproStep));
  if (finding.reproSteps.length > MAX_REPRO_STEPS) {
    steps[MAX_REPRO_STEPS - 1] = `${steps[MAX_REPRO_STEPS - 1]}${TRUNCATED}`;
  }
  return {
    ...finding,
    title: cap(sanitizeText(finding.title), LIMITS.title),
    actual: cap(sanitizeText(finding.actual), LIMITS.actual),
    expected: cap(sanitizeText(finding.expected), LIMITS.expected),
    ...(finding.errorText === undefined
      ? {}
      : { errorText: cap(finding.errorText, LIMITS.errorText) }),
    reproSteps: steps,
  };
};
