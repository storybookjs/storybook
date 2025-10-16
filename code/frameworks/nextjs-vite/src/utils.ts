import semver from 'semver';

export const getNextjsVersion = (): string => require('next/package.json').version;

export const isNextVersionGte = (version: string): boolean => {
  const currentVersion = getNextjsVersion();
  const coercedVersion = semver.coerce(currentVersion);
  return coercedVersion ? semver.gte(coercedVersion, version) : false;
};
