import { readFile, writeFile } from 'node:fs/promises';

import { formatFileContent } from 'storybook/internal/common';
import { loadCsf, printCsf } from 'storybook/internal/csf-tools';

import { wrapArgsMocks } from '../../codemod/helpers/wrap-args-mocks.ts';
import { crossesVersionBoundary, isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

const introducedIn = '11.0.0';

interface CsfNextMockedArgsOptions {
  files: { path: string; source: string }[];
}

export const transformCsfNextMockedArgs = (source: string) => {
  let csf;
  try {
    csf = loadCsf(source, { makeTitle: () => 'FIXME' }).parse();
  } catch {
    return source;
  }
  if (!csf._metaIsFactory || !wrapArgsMocks(csf._ast)) {
    return source;
  }
  return printCsf(csf).code;
};

export const csfNextMockedArgs: Fix<CsfNextMockedArgsOptions> = {
  id: 'csf-next-mocked-args',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#csf-next-use-mocked-for-the-mock-api-on-args',

  async check({ storiesPaths, beforeVersion, storybookVersion, requested }) {
    if (!isAtOrPastVersion(storybookVersion, introducedIn)) {
      return null;
    }
    if (
      !requested &&
      !(beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, introducedIn))
    ) {
      return null;
    }

    const files: CsfNextMockedArgsOptions['files'] = [];
    for (const path of storiesPaths) {
      const source = await readFile(path, 'utf8');
      const transformed = transformCsfNextMockedArgs(source);
      if (transformed !== source) {
        files.push({ path, source: transformed });
      }
    }
    return files.length > 0 ? { files } : null;
  },

  prompt: () => 'Wrap mock API calls on args in mocked() in CSF Next stories',

  async run({ dryRun, result }) {
    if (dryRun) {
      return;
    }
    for (const { path, source } of result.files) {
      await writeFile(path, await formatFileContent(path, source));
    }
  },
};
