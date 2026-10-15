/**
 * @file CSF properties that Storybook indexes must be statically analyzable
 */
import { isExportStory } from '../utils/csf-helpers.ts';

import type { TSESTree } from '@typescript-eslint/types';

import {
  getDescriptor,
  getMetaObjectExpression,
  isCsfFactoryStoryCall,
  parseFactoryMetaCall,
  resolveIdentifierInit,
  unwrapCsfTSWrappers,
} from '../utils/index.ts';
import {
  isArrayExpression,
  isIdentifier,
  isLiteral,
  isObjectExpression,
  isProperty,
  isSpreadElement,
  isTSSatisfiesExpression,
  isVariableDeclaration,
} from '../utils/ast.ts';
import { CategoryId } from '../utils/constants.ts';
import { createStorybookRule } from '../utils/create-storybook-rule.ts';

const isStaticString = (node: TSESTree.Node): boolean =>
  isLiteral(node) && typeof node.value === 'string';

const isStaticRegExp = (node: TSESTree.Node): boolean => isLiteral(node) && 'regex' in node;

const isStaticStringArray = (node: TSESTree.Node): boolean =>
  isArrayExpression(node) && node.elements.every((element) => element && isStaticString(element));

interface StaticPropertyCheck {
  /** Whether csf-tools follows an identifier to a top-level variable in the same file. */
  resolveIdentifier: boolean;
  isValid: (node: TSESTree.Node) => boolean;
  expected: string;
}

const META_PROPERTIES: Record<string, StaticPropertyCheck> = {
  title: {
    resolveIdentifier: true,
    isValid: (node) =>
      isStaticString(node) || (isTSSatisfiesExpression(node) && isStaticString(node.expression)),
    expected: 'a string literal (or a top-level `const` in this file holding one)',
  },
  id: {
    resolveIdentifier: false,
    isValid: isStaticString,
    expected: 'a string literal',
  },
  tags: {
    resolveIdentifier: true,
    isValid: isStaticStringArray,
    expected:
      'an inline array of string literals (or a top-level `const` in this file holding one)',
  },
  includeStories: {
    resolveIdentifier: false,
    isValid: (node) => isStaticString(node) || isStaticRegExp(node) || isStaticStringArray(node),
    expected: 'a string literal, regular expression literal, or inline array of string literals',
  },
  excludeStories: {
    resolveIdentifier: false,
    isValid: (node) => isStaticString(node) || isStaticRegExp(node) || isStaticStringArray(node),
    expected: 'a string literal, regular expression literal, or inline array of string literals',
  },
};

const STORY_PROPERTIES: Record<string, StaticPropertyCheck> = {
  tags: META_PROPERTIES.tags,
};

interface StoryCandidate {
  exportName: string;
  object: TSESTree.ObjectExpression;
  isFactory: boolean;
}

export default createStorybookRule({
  name: 'static-csf-properties',
  defaultOptions: [],
  meta: {
    type: 'problem',
    severity: 'error',
    hasSuggestions: true,
    docs: {
      description: 'CSF properties that Storybook reads statically must be analyzable',
      categories: [CategoryId.CSF, CategoryId.RECOMMENDED],
    },
    messages: {
      dynamicProperty:
        'Storybook indexes stories without running them, so `{{property}}` must be {{expected}}. A dynamic value breaks indexing for this file.',
      propertyBeforeSpread:
        'Storybook reads `{{property}}` statically, but a later spread can override it at runtime. Move it after the spread so the index matches what renders.',
      movePropertyAfterSpread: 'Move `{{property}}` after the spread',
      ignoredKey:
        "Storybook's indexer only recognizes `{{property}}` written as an identifier key; this form is silently ignored.",
      useIdentifierKey: 'Use an identifier key',
      misreadComputedKey:
        "Storybook's indexer reads this computed key as a static `{{property}}` property, which can differ from its runtime name.",
      unresolvableFactoryMeta:
        '`.meta()` must be given an inline object literal (or a `const` in this file holding one); otherwise Storybook indexes this file as if the meta were empty.',
      invalidPreviewImport:
        'The `preview` factory must be imported from your `.storybook/preview` file; Storybook cannot index this file otherwise.',
    },
    schema: [],
  },

  create(context) {
    const checkStaticObject = (
      object: TSESTree.ObjectExpression,
      checks: Record<string, StaticPropertyCheck>
    ) => {
      const lastSpreadIndex = object.properties.findLastIndex(isSpreadElement);

      object.properties.forEach((prop, index) => {
        if (!isProperty(prop)) {
          return;
        }

        const { key } = prop;
        const quotedName =
          isLiteral(key) && typeof key.value === 'string' && key.value in checks
            ? key.value
            : undefined;
        if (quotedName) {
          context.report({
            node: key,
            messageId: 'ignoredKey',
            data: { property: quotedName },
            suggest: prop.computed
              ? undefined
              : [
                  {
                    messageId: 'useIdentifierKey',
                    fix: (fixer) => fixer.replaceText(key, quotedName),
                  },
                ],
          });
          return;
        }

        if (!isIdentifier(key) || !(key.name in checks)) {
          return;
        }

        if (prop.computed) {
          context.report({
            node: key,
            messageId: 'misreadComputedKey',
            data: { property: key.name },
          });
          return;
        }

        const check = checks[key.name];
        let value: TSESTree.Node = prop.value;
        if (check.resolveIdentifier && isIdentifier(value)) {
          value = resolveIdentifierInit(context, value) ?? value;
        }

        if (!check.isValid(value)) {
          context.report({
            node: prop,
            messageId: 'dynamicProperty',
            data: { property: key.name, expected: check.expected },
          });
          return;
        }

        if (index < lastSpreadIndex) {
          const lastSpread = object.properties[lastSpreadIndex];
          context.report({
            node: prop,
            messageId: 'propertyBeforeSpread',
            data: { property: key.name },
            suggest: [
              {
                messageId: 'movePropertyAfterSpread',
                data: { property: key.name },
                fix: (fixer) => {
                  const propText = context.sourceCode.getText(prop);
                  const nextToken = context.sourceCode.getTokenAfter(prop);
                  const removalEnd = nextToken?.value === ',' ? nextToken.range[1] : prop.range[1];
                  return [
                    fixer.removeRange([prop.range[0], removalEnd]),
                    fixer.insertTextAfter(lastSpread, `, ${propText}`),
                  ];
                },
              },
            ],
          });
        }
      });
    };

    let meta: TSESTree.ObjectExpression | null = null;
    let metaIsFactory = false;
    const storyCandidates: StoryCandidate[] = [];

    const collectStoryCandidate = (exportName: string, init: TSESTree.Node) => {
      let storyNode: TSESTree.Node | undefined = unwrapCsfTSWrappers(init);
      let isFactory = false;
      if (isCsfFactoryStoryCall(storyNode)) {
        isFactory = true;
        storyNode = storyNode.arguments[0];
      }
      if (storyNode && isObjectExpression(storyNode)) {
        storyCandidates.push({ exportName, object: storyNode, isFactory });
      }
    };

    return {
      ExportDefaultDeclaration(node) {
        const metaObject = getMetaObjectExpression(node, context);
        if (metaObject) {
          meta = metaObject;
          checkStaticObject(metaObject, META_PROPERTIES);
        }
      },

      CallExpression(node: TSESTree.CallExpression) {
        const factoryMeta = parseFactoryMetaCall(node, context);
        if (!factoryMeta) {
          return;
        }
        if (!factoryMeta.validPreviewImport) {
          context.report({ node, messageId: 'invalidPreviewImport' });
          return;
        }
        metaIsFactory = true;
        if (factoryMeta.metaObject) {
          meta = factoryMeta.metaObject;
          checkStaticObject(factoryMeta.metaObject, META_PROPERTIES);
        } else {
          context.report({ node: node.arguments[0] ?? node, messageId: 'unresolvableFactoryMeta' });
        }
      },

      ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
        const declaration = node.declaration;
        if (isVariableDeclaration(declaration)) {
          declaration.declarations.forEach((declarator) => {
            if (isIdentifier(declarator.id) && declarator.init) {
              collectStoryCandidate(declarator.id.name, declarator.init);
            }
          });
          return;
        }
        if (!declaration) {
          // export { X as Y }: csf-tools resolves the local initializer
          node.specifiers.forEach((specifier) => {
            if (specifier.exportKind === 'type' || !isIdentifier(specifier.local)) {
              return;
            }
            const exportName = isIdentifier(specifier.exported)
              ? specifier.exported.name
              : String(specifier.exported.value);
            const init = resolveIdentifierInit(context, specifier.local);
            if (init) {
              if (exportName === 'default') {
                // export { X as default } is a CSF3 meta
                const metaObject = unwrapCsfTSWrappers(init);
                if (isObjectExpression(metaObject)) {
                  meta = metaObject;
                  checkStaticObject(metaObject, META_PROPERTIES);
                }
                return;
              }
              collectStoryCandidate(exportName, init);
            }
          });
        }
      },

      'Program:exit'() {
        if (!meta && !metaIsFactory) {
          return;
        }

        let nonStoryExports = {};
        try {
          nonStoryExports = meta
            ? {
                includeStories: getDescriptor(meta, 'includeStories'),
                excludeStories: getDescriptor(meta, 'excludeStories'),
              }
            : {};
        } catch {
          //
        }

        storyCandidates.forEach(({ exportName, object, isFactory }) => {
          if (exportName === '__namedExportsOrder' || !isExportStory(exportName, nonStoryExports)) {
            return;
          }
          // Mixing factory and non-factory styles breaks the file for other reasons;
          // the indexer only reads annotations from exports matching the meta's style
          if (metaIsFactory !== isFactory) {
            return;
          }
          checkStaticObject(object, STORY_PROPERTIES);
        });
      },
    };
  },
});
