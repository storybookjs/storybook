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

/**
 * Checks if a variable declaration with the given identifier name exists in the program body.
 * Covers var/let/const declarations and assignment patterns.
 */
function hasExistingDeclaration(program: t.Program, identifierName: string): boolean {
  return program.body.some((node) => {
    // Check variable declarations (const, let, var)
    if (t.isVariableDeclaration(node)) {
      return node.declarations.some((decl) => {
        if (t.isVariableDeclarator(decl) && t.isIdentifier(decl.id)) {
          return decl.id.name === identifierName;
        }
        return false;
      });
    }

    // Check export named declarations with variable declarations
    if (
      t.isExportNamedDeclaration(node) &&
      node.declaration &&
      t.isVariableDeclaration(node.declaration)
    ) {
      return node.declaration.declarations.some((decl) => {
        if (t.isVariableDeclarator(decl) && t.isIdentifier(decl.id)) {
          return decl.id.name === identifierName;
        }
        return false;
      });
    }

    // Check function declarations
    if (t.isFunctionDeclaration(node) && t.isIdentifier(node.id)) {
      return node.id.name === identifierName;
    }

    // Check export named declarations with function declarations
    if (
      t.isExportNamedDeclaration(node) &&
      node.declaration &&
      t.isFunctionDeclaration(node.declaration)
    ) {
      return t.isIdentifier(node.declaration.id) && node.declaration.id.name === identifierName;
    }

    return false;
  });
}

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
      // Only add imports for symbols that are actually used
      if (hasRequireUsage) {
        mainConfig.setImport(['createRequire'], 'node:module');
      }
      if (hasUnderscoreDirname) {
        mainConfig.setImport(['dirname'], 'node:path');
      }
      if (hasUnderscoreFilename || hasUnderscoreDirname) {
        mainConfig.setImport(['fileURLToPath'], 'node:url');
      }

      // Find the index after the last import declaration
      const body = mainConfig._ast.program.body;
      let lastImportIndex = -1;
      for (let i = 0; i < body.length; i++) {
        if (t.isImportDeclaration(body[i])) {
          lastImportIndex = i;
        }
      }
      const insertIndex = lastImportIndex + 1;

      // Check for existing declarations before inserting
      const hasExistingFilename = hasExistingDeclaration(mainConfig._ast.program, '__filename');
      const hasExistingDirname = hasExistingDeclaration(mainConfig._ast.program, '__dirname');
      const hasExistingRequire = hasExistingDeclaration(mainConfig._ast.program, 'require');

      // Add __filename and __dirname if used and not already declared
      if (hasUnderscoreFilename || hasUnderscoreDirname) {
        const declarationsToInsert: t.Statement[] = [];
        let insertOffset = 0;

        // Add __filename declaration if needed and not already exists
        // Note: __filename is always needed if __dirname is used, since __dirname depends on __filename
        if ((hasUnderscoreFilename || hasUnderscoreDirname) && !hasExistingFilename) {
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
          declarationsToInsert.push(filenameDeclaration);
          insertOffset++;
        }

        // Add __dirname declaration if needed and not already exists
        if (hasUnderscoreDirname && !hasExistingDirname) {
          const dirnameDeclaration = t.variableDeclaration('const', [
            t.variableDeclarator(
              t.identifier('__dirname'),
              t.callExpression(t.identifier('dirname'), [t.identifier('__filename')])
            ),
          ]);
          declarationsToInsert.push(dirnameDeclaration);
          insertOffset++;
        }

        // Insert declarations after imports
        declarationsToInsert.forEach((declaration, index) => {
          body.splice(insertIndex + index, 0, declaration);
        });
      }

      // add require if used and not already declared
      if (hasRequireUsage && !hasExistingRequire) {
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

        // Calculate insert position: after imports and after any __filename/__dirname declarations that were added
        const filenameAdded =
          (hasUnderscoreFilename || hasUnderscoreDirname) && !hasExistingFilename;
        const dirnameAdded = hasUnderscoreDirname && !hasExistingDirname;
        const declarationsAdded = (filenameAdded ? 1 : 0) + (dirnameAdded ? 1 : 0);
        const currentInsertIndex = insertIndex + declarationsAdded;
        body.splice(currentInsertIndex, 0, requireDeclaration);
      }
    });

    const content = await readFile(mainConfigPath, 'utf-8');
    const newContent = [bannerComment, content].join('\n');
    await writeFile(mainConfigPath, newContent);
  },
} satisfies Fix<BannerConfig>;
