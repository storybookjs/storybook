const PKG_PR_NEW_CLI_SPECIFIER_IN_TEXT_RE =
  /https?:\/\/[^/\s'"]*pkg\.pr\.new\/(?:[^@\s/]+\/[^@\s/]+\/)?(?:create-storybook|storybook)@[^\s'"]+/;

const PACKAGE_AT_SPECIFIER_RE = /\s(?:create-storybook|storybook)@([^\s'"]+)/;

export type ProcessAncestryEntry = {
  command?: string | null;
};

const stripQuotedUrls = (command: string) => command.replace(/['"](https?:\/\/[^'"]+)['"]/g, '$1');

/**
 * Read a Storybook version specifier from process ancestry.
 *
 * Prefers a pkg.pr.new CLI URL in the command so `npx --yes https://pkg.pr.new/.../storybook@sha`
 * and `npx storybook@https://pkg.pr.new/...` resolve to the same source. Falls back to
 * `create-storybook@<spec>` / `storybook@<spec>` for npm tags and semver.
 */
export const getStorybookVersionSpecifierFromAncestry = (
  ancestry: readonly ProcessAncestryEntry[]
): string | undefined => {
  for (const ancestor of ancestry.toReversed()) {
    const command = ancestor.command;
    if (!command) {
      continue;
    }

    const normalized = stripQuotedUrls(command);
    const pkgPrNewMatch = normalized.match(PKG_PR_NEW_CLI_SPECIFIER_IN_TEXT_RE);
    if (pkgPrNewMatch) {
      return pkgPrNewMatch[0];
    }

    const packageAtMatch = normalized.match(PACKAGE_AT_SPECIFIER_RE);
    if (packageAtMatch) {
      return packageAtMatch[1];
    }
  }

  return undefined;
};
