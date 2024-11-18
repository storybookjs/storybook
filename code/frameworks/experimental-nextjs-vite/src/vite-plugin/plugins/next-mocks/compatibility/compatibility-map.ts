import semver from 'semver';

import { getNextjsVersion } from './utils';

const mapping: Record<string, Record<string, string | boolean>> = {
  '<15.0.0': {
    'next/dist/server/request/headers': 'next/dist/client/components/headers',
    // this path only exists from Next 15 onwards
    'next/dist/server/request/draft-mode': '@storybook/nextjs/dist/compatibility/draft-mode.compat',
  },
};

export const getCompatibilityAliases = () => {
  const version = getNextjsVersion();
  console.log({ version });
  const result: Record<string, string> = {};

  Object.keys(mapping).forEach((key) => {
    if (semver.intersects(version, key)) {
      Object.assign(result, mapping[key]);
    }
  });

  return result;
};
