export const getPkgPrNewPackageSpecifier = (
  packageName: string,
  storybookVersionSpecifier?: string
) => {
  if (!storybookVersionSpecifier) {
    return undefined;
  }

  const match = storybookVersionSpecifier.match(
    /^(https?:\/\/[^/\s]*pkg\.pr\.new\/)(?:create-storybook|storybook|@storybook\/[^@\s]+)(@[^\s]+)$/
  );

  if (!match) {
    return undefined;
  }

  const [, prefix, suffix] = match;
  return `${prefix}${packageName}${suffix}`;
};
