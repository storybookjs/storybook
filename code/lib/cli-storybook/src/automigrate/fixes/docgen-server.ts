import { types as t } from 'storybook/internal/babel';
import type { ConfigFile } from 'storybook/internal/csf-tools';

import { getFrameworkPackageName, getRendererName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary, isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

type DocgenFramework = 'react' | 'vue' | 'angular' | 'other';

const manualGuidance =
  'Rename features.experimentalDocgenServer to features.docgenServer manually, preserving expressions and stable-flag precedence. With neither flag present, set docgenServer: false to retain React reactDocgen: false or react-docgen-typescript, or an explicit Vue docgen setting. Do not translate RDT propFilter or Vue tsconfig to server options.';

function preservesLegacyDocgen(main: ConfigFile, framework: 'react' | 'vue'): boolean {
  if (framework === 'vue' && t.isStringLiteral(main.get(['framework']))) {
    return false;
  }
  const path =
    framework === 'react' ? ['typescript', 'reactDocgen'] : ['framework', 'options', 'docgen'];
  const legacy = main.get(path);
  if (!legacy) {
    return false;
  }
  if (t.isBooleanLiteral(legacy)) {
    return framework === 'vue' || !legacy.value;
  }
  if (t.isStringLiteral(legacy)) {
    return framework === 'vue' || legacy.value === 'react-docgen-typescript';
  }
  if (framework === 'vue' && t.isObjectExpression(legacy)) {
    return true;
  }
  throw new Error(`Cannot safely migrate dynamic ${path.join('.')}. ${manualGuidance}`);
}

function migrateDocgenServer(main: ConfigFile, framework: DocgenFramework): void {
  const deprecated = main.get(['features', 'experimentalDocgenServer']);
  const stable = main.get(['features', 'docgenServer']);

  if (framework === 'other') {
    if (deprecated) {
      main.remove(['features', 'experimentalDocgenServer']);
    }
  } else if (deprecated) {
    if (!stable) {
      main.rename(['features', 'experimentalDocgenServer'], 'docgenServer');
    } else if (t.isBooleanLiteral(stable) && t.isBooleanLiteral(deprecated)) {
      main.remove(['features', 'experimentalDocgenServer']);
    } else {
      throw new Error(`Cannot safely combine dynamic docgen flags. ${manualGuidance}`);
    }
  } else if (
    !stable &&
    (framework === 'react' || framework === 'vue') &&
    preservesLegacyDocgen(main, framework)
  ) {
    main.set(['features', 'docgenServer'], false);
  }
}

export const docgenServer: Fix<{ framework: DocgenFramework }> = {
  id: 'docgen-server',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#docgenserver-is-stable-and-enabled-by-default',
  prompt: () => 'Rename the docgenServer feature and preserve explicit legacy extraction settings',

  async check({ mainConfig, beforeVersion, storybookVersion, requested }) {
    if (!isAtOrPastVersion(storybookVersion, '11.0.0')) {
      return null;
    }
    if (
      !requested &&
      !(beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, '11.0.0'))
    ) {
      return null;
    }
    const renderer = getRendererName(mainConfig);
    const framework =
      renderer === 'react'
        ? 'react'
        : renderer === 'vue3'
          ? 'vue'
          : getFrameworkPackageName(mainConfig) === '@storybook/angular-vite'
            ? 'angular'
            : 'other';
    return { framework };
  },

  transform: ({ result }) => [
    {
      filter: { kind: ['main'] },
      editConfig: (main) => migrateDocgenServer(main, result.framework),
    },
  ],
};
