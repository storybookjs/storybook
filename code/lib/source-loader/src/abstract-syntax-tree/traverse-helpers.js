import { isExportStory } from '@storybook/csf';

import estraverse from 'estraverse';

import { handleADD, handleExportedName, handleSTORYOF, patchNode } from './parse-helpers';

export function splitSTORYOF(ast, source) {
  let lastIndex = 0;
  const parts = [source];

  estraverse.traverse(ast, {
    fallback: 'iteration',
    enter: (node) => {
      patchNode(node);

      if (node.type === 'CallExpression') {
        lastIndex = handleSTORYOF(node, parts, source, lastIndex);
      }
    },
  });

  return parts;
}

function isFunctionVariable(declarations, includeExclude) {
  return (
    declarations &&
    declarations.length === 1 &&
    declarations[0].type === 'VariableDeclarator' &&
    declarations[0].id &&
    declarations[0].id.name &&
    declarations[0].init &&
    [
      'CallExpression',
      'ArrowFunctionExpression',
      'FunctionExpression',
      'ObjectExpression', // CSF3
    ].includes(declarations[0].init.type) &&
    isExportStory(declarations[0].id.name, includeExclude)
  );
}

function isFunctionDeclaration(declaration, includeExclude) {
  return (
    declaration.type === 'FunctionDeclaration' &&
    declaration.id &&
    declaration.id.name &&
    isExportStory(declaration.id.name, includeExclude)
  );
}

function getDescriptor(metaDeclaration, propertyName) {
  const property =
    metaDeclaration &&
    metaDeclaration.declaration &&
    metaDeclaration.declaration.properties.find((p) => p.key && p.key.name === propertyName);
  if (!property) {
    return undefined;
  }

  const { type } = property.value;

  switch (type) {
    case 'ArrayExpression':
      return property.value.elements.map((t) => {
        if (!['StringLiteral', 'Literal'].includes(t.type)) {
          throw new Error(`Unexpected descriptor element: ${t.type}`);
        }
        return t.value;
      });
    case 'Literal':
    case 'RegExpLiteral':
      return property.value.value;
    default:
      throw new Error(`Unexpected descriptor: ${type}`);
  }
}

function findIncludeExclude(ast) {
  const program = (ast && ast.program) || ast;
  const metaDeclaration =
    program &&
    program.body &&
    program.body.find(
      (d) =>
        d.type === 'ExportDefaultDeclaration' &&
        d.declaration.type === 'ObjectExpression' &&
        (d.declaration.properties || []).length
    );

  const includeStories = getDescriptor(metaDeclaration, 'includeStories');
  const excludeStories = getDescriptor(metaDeclaration, 'excludeStories');

  return {
    includeStories,
    excludeStories,
  };
}

export function splitExports(ast, source) {
  const parts = [];
  let lastIndex = 0;

  const includeExclude = findIncludeExclude(ast);

  estraverse.traverse(ast, {
    fallback: 'iteration',
    enter: (node) => {
      patchNode(node);

      const isNamedExport = node.type === 'ExportNamedDeclaration' && node.declaration;

      const isFunctionVariableExport =
        isNamedExport && isFunctionVariable(node.declaration.declarations, includeExclude);
      const isFunctionDeclarationExport =
        isNamedExport && isFunctionDeclaration(node.declaration, includeExclude);

      if (isFunctionDeclarationExport || isFunctionVariableExport) {
        const functionNode = isFunctionVariableExport
          ? node.declaration.declarations[0].init
          : node.declaration;
        parts.push({
          source: source.substring(lastIndex, functionNode.start - 1),
        });
        parts.push({
          source: source.substring(functionNode.start, functionNode.end),
          declaration: {
            isVariableDeclaration: isFunctionVariableExport,
            ident: isFunctionVariableExport
              ? node.declaration.declarations[0].id.name
              : functionNode.id.name,
          },
        });
        lastIndex = functionNode.end;
      }
    },
  });

  if (source.length > lastIndex + 1) {
    parts.push({ source: source.substring(lastIndex + 1) });
  }

  if (parts.length === 1) {
    return [source];
  }
  return parts;
}

export function findAddsMap(ast, storiesOfIdentifiers) {
  const addsMap = {};

  estraverse.traverse(ast, {
    fallback: 'iteration',
    enter: (node, parent) => {
      patchNode(node);

      if (node.type === 'MemberExpression') {
        const { toAdd, idToFramework } = handleADD(node, parent, storiesOfIdentifiers);
        Object.assign(addsMap, toAdd);
      }
    },
  });

  return addsMap;
}

export function findExportsMap(ast) {
  const addsMap = {};
  estraverse.traverse(ast, {
    fallback: 'iteration',
    enter: (node, parent) => {
      patchNode(node);

      const isNamedExport = node.type === 'ExportNamedDeclaration' && node.declaration;

      const isFunctionVariableExport =
        isNamedExport &&
        node.declaration.declarations &&
        node.declaration.declarations.length === 1 &&
        node.declaration.declarations[0].type === 'VariableDeclarator' &&
        node.declaration.declarations[0].id &&
        node.declaration.declarations[0].id.name &&
        node.declaration.declarations[0].init &&
        [
          'CallExpression',
          'ArrowFunctionExpression',
          'FunctionExpression',
          'ObjectExpression', // CSF3
        ].includes(node.declaration.declarations[0].init.type);

      const isFunctionDeclarationExport =
        isNamedExport &&
        node.declaration.type === 'FunctionDeclaration' &&
        node.declaration.id &&
        node.declaration.id.name;

      if (isFunctionDeclarationExport || isFunctionVariableExport) {
        const exportDeclaration = isFunctionVariableExport
          ? node.declaration.declarations[0]
          : node.declaration;
        const toAdd = handleExportedName(
          exportDeclaration.id.name,
          exportDeclaration.init || exportDeclaration,
          parent
        );
        Object.assign(addsMap, toAdd);
      }
    },
  });
  return addsMap;
}

export function popParametersObjectFromDefaultExport(source, ast) {
  let splicedSource = source;
  let parametersSliceOfCode = '';
  let indexWhereToAppend = -1;
  let foundParametersProperty = false;
  estraverse.traverse(ast, {
    fallback: 'iteration',
    enter: (node) => {
      patchNode(node);

      const isDefaultExport = node.type === 'ExportDefaultDeclaration';
      let decl = node.declaration;

      // handle `const meta = { }; export default meta;`
      if (isDefaultExport && decl?.type === 'Identifier') {
        ast.body.forEach((n) => {
          if (n.type === 'VariableDeclaration') {
            n.declarations.forEach((d) => {
              if (d.id.name === decl.name) {
                decl = d.init;
              }
            });
          }
        });
      }

      const isObjectExpression = decl?.type === 'ObjectExpression';
      const isTsAsExpression = decl?.type === 'TSAsExpression';
      const targetNode = isObjectExpression ? decl : decl?.expression;

      if (
        isDefaultExport &&
        (isObjectExpression || isTsAsExpression) &&
        (targetNode.properties || []).length
      ) {
        const parametersProperty = targetNode.properties.find(
          (p) => p.key && p.key.name === 'parameters' && p.value.type === 'ObjectExpression'
        );

        foundParametersProperty = !!parametersProperty;
        if (foundParametersProperty) {
          patchNode(parametersProperty.value);
        } else {
          patchNode(targetNode);
        }

        splicedSource = parametersProperty
          ? source.substring(0, parametersProperty.value.start) +
            source.substring(parametersProperty.value.end + 1)
          : splicedSource;

        parametersSliceOfCode = parametersProperty
          ? source.substring(parametersProperty.value.start, parametersProperty.value.end)
          : '{}';

        indexWhereToAppend = parametersProperty
          ? parametersProperty.value.start
          : targetNode.start + 1;
      }
    },
  });
  return { splicedSource, parametersSliceOfCode, indexWhereToAppend, foundParametersProperty };
}
