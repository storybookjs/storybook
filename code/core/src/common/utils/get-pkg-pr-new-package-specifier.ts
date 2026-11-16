const PKG_PR_NEW_STORYBOOK_SPECIFIER_RE =
  /^(https?:\/\/[^/\s]*pkg\.pr\.new\/)(?:([^@\s/]+)\/(?:([^@\s/]+)\/)?)?(?:create-storybook|storybook|@storybook\/[^@\s]+)(@[^\s]+)$/;

// pkg.pr.new also serves `storybook` as `<owner>/storybook@<ref>`, without a package segment.
const getPkgPrNewRepoPrefix = (storybookVersionSpecifier?: string) => {
  const match = storybookVersionSpecifier?.match(PKG_PR_NEW_STORYBOOK_SPECIFIER_RE);
  if (!match) {
    return undefined;
  }

  const [, host, owner, repo, suffix] = match;
  if (!owner) {
    return { prefix: host, suffix };
  }
  if (repo) {
    return { prefix: `${host}${owner}/${repo}/`, suffix };
  }
  if (storybookVersionSpecifier?.startsWith(`${host}${owner}/storybook@`)) {
    return { prefix: `${host}${owner}/storybook/`, suffix };
  }
  return undefined;
};

export const isPkgPrNewVersionSpecifier = (storybookVersionSpecifier?: string) =>
  !!getPkgPrNewRepoPrefix(storybookVersionSpecifier);

export const getPkgPrNewPackageSpecifier = (
  packageName: string,
  storybookVersionSpecifier?: string
) => {
  const parsed = getPkgPrNewRepoPrefix(storybookVersionSpecifier);
  if (!parsed) {
    return undefined;
  }

  return `${parsed.prefix}${packageName}${parsed.suffix}`;
};
