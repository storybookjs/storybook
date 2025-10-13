import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import {
  type BannerConfig,
  bannerComment,
  containsDirnameUsage,
  containsESMUsage,
  containsFilenameUsage,
  containsRequireUsage,
  hasRequireBanner,
  updateMainConfig,
} from '../helpers/mainConfigFile';
import type { Fix } from '../types';

export const fixFauxEsmRequire = {
  id: 'fix-faux-esm-require',
  link: 'https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments',

  async check({ mainConfigPath }) {
    if (!mainConfigPath) {
      return null;
    }

    // Read the raw file content to check for ESM syntax and require usage
    const content = await readFile(mainConfigPath, 'utf-8');

    const isESM = containsESMUsage(content);
    const isWithBanner = hasRequireBanner(content);

    // Check if the file is ESM format based on content
    if (!isESM) {
      return null;
    }

    // Check if the file already has the require banner
    if (isWithBanner) {
      return null;
    }

    // Analyze what compatibility features are needed
    const hasRequireUsage = containsRequireUsage(content);
    const hasUnderscoreFilename = containsFilenameUsage(content);
    const hasUnderscoreDirname = containsDirnameUsage(content);

    // Check if any compatibility features are needed
    if (hasRequireUsage || hasUnderscoreFilename || hasUnderscoreDirname) {
      return {
        hasRequireUsage,
        hasUnderscoreDirname,
        hasUnderscoreFilename,
      };
    }

    return null;
  },

  prompt() {
    return dedent`Main config is ESM but uses 'require' or '__dirname'. This will break in Storybook 10; Adding compatibility banner`;
  },

  async run({ dryRun, mainConfigPath, result }) {
    if (dryRun) {
      return;
    }

    const { hasRequireUsage, hasUnderscoreDirname, hasUnderscoreFilename } = result;

    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, (mainConfig) => {
      mainConfig.setImport(['createRequire'], 'node:module');
      mainConfig.setImport(['dirname'], 'node:path');
      mainConfig.setImport(['fileURLToPath'], 'node:url');

      // Find the index after the last import declaration
      const body = mainConfig._ast.program.body;
      let lastImportIndex = -1;
      for (let i = 0; i < body.length; i++) {
        if (t.isImportDeclaration(body[i])) {
          lastImportIndex = i;
        }
      }
      const insertIndex = lastImportIndex + 1;

      // Add __filename and __dirname if used
      if (hasUnderscoreFilename || hasUnderscoreDirname) {
        const filenameDeclaration = t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('__filename'),
            t.callExpression(t.identifier('fileURLToPath'), [
              t.memberExpression(
                t.metaProperty(t.identifier('import'), t.identifier('meta')),
                t.identifier('url')
              ),
            ])
          ),
        ]);
        const dirnameDeclaration = t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('__dirname'),
            t.callExpression(t.identifier('dirname'), [t.identifier('__filename')])
          ),
        ]);

        // Insert after imports
        body.splice(insertIndex, 0, filenameDeclaration);
        body.splice(insertIndex + 1, 0, dirnameDeclaration);
      }

      // add require if used
      if (hasRequireUsage) {
        const requireDeclaration = t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('require'),
            t.callExpression(t.identifier('createRequire'), [
              t.memberExpression(
                t.metaProperty(t.identifier('import'), t.identifier('meta')),
                t.identifier('url')
              ),
            ])
          ),
        ]);

        // Insert after imports (and after __filename/__dirname if they were added)
        const currentInsertIndex =
          hasUnderscoreFilename || hasUnderscoreDirname ? insertIndex + 2 : insertIndex;
        body.splice(currentInsertIndex, 0, requireDeclaration);
      }
    });

    const content = await readFile(mainConfigPath, 'utf-8');
    const newContent = [bannerComment, content].join('\n');
    await writeFile(mainConfigPath, newContent);
  },
} satisfies Fix<BannerConfig>;
