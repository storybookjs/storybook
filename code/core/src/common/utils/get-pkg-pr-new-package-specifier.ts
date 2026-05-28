const PKG_PR_NEW_STORYBOOK_SPECIFIER_RE =
  /^(https?:\/\/[^/\s]*pkg\.pr\.new\/)(?:create-storybook|storybook|@storybook\/[^@\s]+)(@[^\s]+)$/;

export const isPkgPrNewVersionSpecifier = (storybookVersionSpecifier?: string) =>
  !!storybookVersionSpecifier?.match(PKG_PR_NEW_STORYBOOK_SPECIFIER_RE);

export const getPkgPrNewPackageSpecifier = (
  packageName: string,
  storybookVersionSpecifier?: string
) => {
  if (!storybookVersionSpecifier) {
    return undefined;
  }

  const match = storybookVersionSpecifier.match(PKG_PR_NEW_STORYBOOK_SPECIFIER_RE);

  if (!match) {
    return undefined;
  }

  const [, prefix, suffix] = match;
  return `${prefix}${packageName}${suffix}`;
};
