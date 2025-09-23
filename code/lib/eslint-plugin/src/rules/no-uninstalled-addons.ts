/**
 * @file This rule identifies storybook addons that are invalid because they are either not
 *   installed or contain a typo in their name.
 * @author Andre "andrelas1" Santos
 */
import type { TSESTree } from '@typescript-eslint/utils';
import { readFileSync } from 'fs';
import { relative, resolve, sep } from 'path';
import { dedent } from 'ts-dedent';

import { getMetaObjectExpression } from '../utils';
import {
  isArrayExpression,
  isIdentifier,
  isLiteral,
  isObjectExpression,
  isProperty,
  isVariableDeclaration,
  isVariableDeclarator,
} from '../utils/ast';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createStorybookRule({
  name: 'no-uninstalled-addons',
  defaultOptions: [
    {
      packageJsonLocation: '' as string,
      ignore: [] as string[],
    },
  ],
  meta: {
    type: 'problem',
    severity: 'error',
    docs: {
      description:
        'This rule identifies storybook addons that are invalid because they are either not installed or contain a typo in their name.',
      categories: [CategoryId.RECOMMENDED],
    },
    messages: {
      addonIsNotInstalled: `The {{ addonName }} is not installed in {{packageJsonPath}}. Did you forget to install it or is your package.json in a different location?`,
    },

    schema: [
      {
        type: 'object',
        properties: {
          packageJsonLocation: {
            type: 'string',
          },
          ignore: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    ],
  },

  create(context) {
    // variables should be defined here
    const { packageJsonLocation, ignore } = context.options.reduce<{
      packageJsonLocation: string;
      ignore: string[];
    }>(
      (acc, val) => {
        return {
          packageJsonLocation: val.packageJsonLocation || acc.packageJsonLocation,
          ignore: val.ignore || acc.ignore,
        };
      },
      { packageJsonLocation: '', ignore: [] }
    );

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    // this will not only exclude the nullables but it will also exclude the type undefined from them, so that TS does not complain
    function excludeNullable<T>(item: T | undefined): item is T {
      return !!item;
    }

    type MergeDepsWithDevDeps = (packageJson: PackageJsonDependencies) => string[];
    const mergeDepsWithDevDeps: MergeDepsWithDevDeps = (packageJson) => {
      const deps = Object.keys(packageJson.dependencies || {});
      const devDeps = Object.keys(packageJson.devDependencies || {});
      return [...deps, ...devDeps];
    };

    type IsAddonInstalled = (addon: string, installedAddons: string[]) => boolean;
    const isAddonInstalled: IsAddonInstalled = (addon, installedAddons) => {
      // cleanup /register or /preset + file extension from registered addon
      const addonName = addon
        .replace(/\.[mc]?js$/, '')
        .replace(/\/register$/, '')
        .replace(/\/preset$/, '');

      return installedAddons.includes(addonName);
    };

    const filterLocalAddons = (addon: string) => {
      const isLocalAddon = (addonName: string) =>
        addonName.startsWith('.') ||
        addonName.startsWith('/') ||
        // for local Windows files e.g. (C: F: D:)
        /\w:.*/.test(addonName) ||
        addonName.startsWith('\\');

      return !isLocalAddon(addon);
    };

    type AreThereAddonsNotInstalled = (
      addons: string[],
      installedSbAddons: string[]
    ) => false | { name: string }[];
    const areThereAddonsNotInstalled: AreThereAddonsNotInstalled = (addons, installedSbAddons) => {
      const result = addons
        // remove local addons (e.g. ./my-addon/register.js)
        .filter(filterLocalAddons)
        .filter((addon) => !isAddonInstalled(addon, installedSbAddons) && !ignore.includes(addon))
        .map((addon) => ({ name: addon }));
      return result.length ? result : false;
    };

    type PackageJsonDependencies = {
      devDependencies: Record<string, string>;
      dependencies: Record<string, string>;
    };

    type GetPackageJson = (path: string) => PackageJsonDependencies;

    const getPackageJson: GetPackageJson = (path) => {
      const packageJson = {
        devDependencies: {},
        dependencies: {},
      };
      try {
        const file = readFileSync(path, 'utf8');
        const parsedFile = JSON.parse(file);
        packageJson.dependencies = parsedFile.dependencies || {};
        packageJson.devDependencies = parsedFile.devDependencies || {};
      } catch (err) {
        // eslint-disable-next-line local-rules/no-uncategorized-errors
        throw new Error(
          dedent`The provided path in your eslintrc.json - ${path} is not a valid path to a package.json file or your package.json file is not in the same folder as ESLint is running from.

          Read more at: https://github.com/storybookjs/storybook/blob/next/code/lib/eslint-plugin/docs/rules/no-uninstalled-addons.md
          `
        );
      }

      return packageJson;
    };

    const extractAllAddonsFromTheStorybookConfig = (
      addonsExpression: TSESTree.ArrayExpression | undefined
    ) => {
      if (addonsExpression?.elements) {
        // extract all nodes taht are a string inside the addons array
        const nodesWithAddons = addonsExpression.elements
          .map((elem) => (isLiteral(elem) ? { value: elem.value, node: elem } : undefined))
          .filter(excludeNullable);

        const listOfAddonsInString = nodesWithAddons.map((elem) => elem.value) as string[];

        // extract all nodes that are an object inside the addons array
        const nodesWithAddonsInObj = addonsExpression.elements
          .map((elem) => (isObjectExpression(elem) ? elem : { properties: [] }))
          .map((elem) => {
            const property: TSESTree.Property = elem.properties.find(
              (prop) => isProperty(prop) && isIdentifier(prop.key) && prop.key.name === 'name'
            ) as TSESTree.Property;
            return isLiteral(property?.value)
              ? { value: property.value.value, node: property.value }
              : undefined;
          })
          .filter(excludeNullable);

        const listOfAddonsInObj = nodesWithAddonsInObj.map((elem) => elem.value) as string[];

        const listOfAddons = [...listOfAddonsInString, ...listOfAddonsInObj];
        const listOfAddonElements = [...nodesWithAddons, ...nodesWithAddonsInObj];
        return { listOfAddons, listOfAddonElements };
      }

      return { listOfAddons: [], listOfAddonElements: [] };
    };

    function reportUninstalledAddons(addonsProp: TSESTree.ArrayExpression) {
      const packageJsonPath = resolve(packageJsonLocation || `./package.json`);
      let packageJsonObject: PackageJsonDependencies;
      try {
        packageJsonObject = getPackageJson(packageJsonPath);
      } catch (e) {
        // if we cannot find the package.json, we cannot check if the addons are installed
        throw new Error(e as string);
      }

      const depsAndDevDeps = mergeDepsWithDevDeps(packageJsonObject);

      const { listOfAddons, listOfAddonElements } =
        extractAllAddonsFromTheStorybookConfig(addonsProp);
      const result = areThereAddonsNotInstalled(listOfAddons, depsAndDevDeps);

      if (result) {
        const elemsWithErrors = listOfAddonElements.filter(
          (elem) => !!result.find((addon) => addon.name === elem.value)
        );

        const rootDir = process.cwd().split(sep).pop();
        const currentPackageJsonPath = `${rootDir}${sep}${relative(process.cwd(), packageJsonLocation)}`;

        elemsWithErrors.forEach((elem) => {
          context.report({
            node: elem.node,
            messageId: 'addonIsNotInstalled',
            data: {
              addonName: elem.value,
              packageJsonPath: currentPackageJsonPath,
            },
          });
        });
      }
    }

    function findAddonsPropAndReport(node: TSESTree.ObjectExpression) {
      const addonsProp = node.properties.find(
        (prop): prop is TSESTree.Property =>
          isProperty(prop) && isIdentifier(prop.key) && prop.key.name === 'addons'
      );

      if (addonsProp?.value && isArrayExpression(addonsProp.value)) {
        reportUninstalledAddons(addonsProp.value);
      }
    }

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    return {
      AssignmentExpression: function (node) {
        if (isObjectExpression(node.right)) {
          findAddonsPropAndReport(node.right);
        }
      },
      ExportDefaultDeclaration: function (node) {
        const meta = getMetaObjectExpression(node, context);

        if (!meta) {
          return null;
        }

        findAddonsPropAndReport(meta);
      },
      ExportNamedDeclaration: function (node) {
        const addonsProp =
          isVariableDeclaration(node.declaration) &&
          node.declaration.declarations.find(
            (decl) =>
              isVariableDeclarator(decl) && isIdentifier(decl.id) && decl.id.name === 'addons'
          );

        if (addonsProp && isArrayExpression(addonsProp.init)) {
          reportUninstalledAddons(addonsProp.init);
        }
      },
    };
  },
});
