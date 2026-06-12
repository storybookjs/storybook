/**
 * GitHub organization and repository identifiers shared by every script that
 * talks to GitHub. Keep this file free of feature-specific constants; those
 * belong with their feature.
 */
export const ORG = 'storybookjs';
export const PRIMARY_REPO = 'storybook';
export const MAINTAINER_TEAM_SLUGS = ['core', 'developer-experience', 'maintainers'];

export const PR_URL_RE =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/;
export const PR_OR_ISSUE_URL_RE =
  /\bhttps:\/\/github\.com\/(storybookjs)\/([A-Za-z0-9_.-]+)\/(issues|pull)\/(\d+)\b/g;
export const SAME_REPO_PR_OR_ISSUE_SHORTHAND_RE = /(?<![A-Za-z0-9_/-])#(\d+)\b/g;
export const CROSS_REPO_PR_OR_ISSUE_SHORTHAND_RE = /\b(storybookjs)\/([A-Za-z0-9_.-]+)#(\d+)\b/g;
