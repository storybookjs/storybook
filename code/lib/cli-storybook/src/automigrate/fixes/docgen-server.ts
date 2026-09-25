import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import { formatFileContent, HandledError } from 'storybook/internal/common';
import { formatConfig, loadConfig, type ConfigFile } from 'storybook/internal/csf-tools';

import { getFrameworkPackageName, getRendererName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary, isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

type DocgenFramework = 'react' | 'vue' | 'angular' | 'svelte' | 'web-components' | 'other';

const manualGuidance =
  'Rename features.experimentalDocgenServer to features.docgenServer manually, preserving expressions and stable-flag precedence. With neither flag present, set docgenServer: false to retain React reactDocgen: false or react-docgen-typescript, or an explicit Vue docgen setting. Do not translate RDT propFilter or Vue tsconfig to server options.';

function preservesLegacyDocgen(main: ConfigFile, framework: 'react' | 'vue'): boolean {
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
  throw new HandledError(`Cannot safely migrate dynamic ${path.join('.')}. ${manualGuidance}`);
}

export function transformDocgenServer(source: string, framework: DocgenFramework): string {
  if (framework === 'other') {
    return source;
  }
  const main = loadConfig(source).parse();
  const deprecated = main.get(['features', 'experimentalDocgenServer']);
  const stable = main.get(['features', 'docgenServer']);

  if (deprecated) {
    if (!stable) {
      main.rename(['features', 'experimentalDocgenServer'], 'docgenServer');
    } else if (t.isBooleanLiteral(stable) && t.isBooleanLiteral(deprecated)) {
      main.remove(['features', 'experimentalDocgenServer']);
    } else {
      throw new HandledError(`Cannot safely combine dynamic docgen flags. ${manualGuidance}`);
    }
  } else if (!stable && (framework === 'react' || framework === 'vue')) {
    if (preservesLegacyDocgen(main, framework)) {
      main.set(['features', 'docgenServer'], false);
    }
  }

  if (main.mutationDiagnostics.length) {
    throw new HandledError(
      `Cannot safely migrate this main config: ${main.mutationDiagnostics.map(({ message }) => message).join('; ')}. ${manualGuidance}`
    );
  }
  return main.changed ? formatConfig(main) : source;
}

export const docgenServer: Fix<{
  mainConfigPath: string;
  framework: DocgenFramework;
}> = {
  // Stryker disable next-line StringLiteral: descriptor is asserted through the upgrade contract.
  id: 'docgen-server',
  // Stryker disable next-line StringLiteral: descriptor is asserted through the upgrade contract.
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#docgenserver-is-stable-and-enabled-by-default',
  // Stryker disable next-line ArrowFunction: descriptor is asserted through the upgrade contract.
  prompt: () => 'Rename the docgenServer feature and preserve explicit legacy extraction settings',

  async check({ mainConfigPath, mainConfig, beforeVersion, storybookVersion, requested }) {
    if (!mainConfigPath || !isAtOrPastVersion(storybookVersion, '11.0.0')) {
      return null;
    }
    if (
      !requested &&
      !(beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, '11.0.0'))
    ) {
      return null;
    }
    const frameworkPackageName = getFrameworkPackageName(mainConfig);
    const framework =
      getRendererName(mainConfig) === 'react'
        ? 'react'
        : frameworkPackageName === '@storybook/vue3-vite'
          ? 'vue'
          : frameworkPackageName === '@storybook/angular-vite'
            ? 'angular'
            : frameworkPackageName === '@storybook/svelte-vite'
              ? 'svelte'
              : frameworkPackageName === '@storybook/web-components-vite'
                ? 'web-components'
                : 'other';
    const source = await readFile(mainConfigPath, 'utf8');
    const transformedSource = transformDocgenServer(source, framework);
    return source === transformedSource ? null : { mainConfigPath, framework };
  },

  async run({ dryRun, result }) {
    const source = await readFile(result.mainConfigPath, 'utf8');
    const transformedSource = transformDocgenServer(source, result.framework);
    if (transformedSource !== source && !dryRun) {
      await writeFile(
        result.mainConfigPath,
        await formatFileContent(result.mainConfigPath, transformedSource)
      );
    }
  },
};
