import { storyNameFromExport } from '@storybook/csf';

import { logger } from '@storybook/core/node-logger';

import prettier from 'prettier';

import { jscodeshiftToPrettierParser, sanitizeName } from '../lib/utils';

/**
 * Convert a legacy story API to component story format
 *
 * For example:
 *
 * ```
 * input { Button } from './Button';
 * storiesOf('Button', module).add('story', () => <Button label="The Button" />);
 * ```
 *
 * Becomes:
 *
 * ```
 * input { Button } from './Button';
 * export default {
 *   title: 'Button'
 * }
 * export const story = () => <Button label="The Button" />;
 *
 * NOTES: only support chained storiesOf() calls
 */
export default async function transformer(file, api, options) {
  const LITERAL = ['ts', 'tsx'].includes(options.parser) ? 'StringLiteral' : 'Literal';

  const j = api.jscodeshift;
  const root = j(file.source);

  function extractDecorators(parameters) {
    if (!parameters) {
      return {};
    }
    if (!parameters.properties) {
      return { storyParams: parameters };
    }
    let storyDecorators = parameters.properties.find((p) => p.key.name === 'decorators');
    if (!storyDecorators) {
      return { storyParams: parameters };
    }
    storyDecorators = storyDecorators.value;
    const storyParams = { ...parameters };
    storyParams.properties = storyParams.properties.filter((p) => p.key.name !== 'decorators');
    if (storyParams.properties.length === 0) {
      return { storyDecorators };
    }
    return { storyParams, storyDecorators };
  }

  function convertToModuleExports(path, originalExports) {
    const base = j(path);

    const statements = [];
    const extraExports = [];

    // .addDecorator
    const decorators = [];
    base
      .find(j.CallExpression)
      .filter(
        (call) => call.node.callee.property && call.node.callee.property.name === 'addDecorator'
      )
      .forEach((add) => {
        const decorator = add.node.arguments[0];
        decorators.push(decorator);
      });
    if (decorators.length > 0) {
      decorators.reverse();
      extraExports.push(
        j.property('init', j.identifier('decorators'), j.arrayExpression(decorators))
      );
    }

    // .addParameters
    const parameters = [];
    base
      .find(j.CallExpression)
      .filter(
        (call) => call.node.callee.property && call.node.callee.property.name === 'addParameters'
      )
      .forEach((add) => {
        // jscodeshift gives us the find results in reverse, but these args come in
        // order, so we double reverse here. ugh.
        const params = [...add.node.arguments[0].properties];
        params.reverse();
        params.forEach((prop) => parameters.push(prop));
      });
    if (parameters.length > 0) {
      parameters.reverse();
      extraExports.push(
        j.property('init', j.identifier('parameters'), j.objectExpression(parameters))
      );
    }

    if (originalExports.length > 0) {
      extraExports.push(
        j.property(
          'init',
          j.identifier('excludeStories'),
          j.arrayExpression(originalExports.map((exp) => j.literal(exp)))
        )
      );
    }

    // storiesOf(...)
    base
      .find(j.CallExpression)
      .filter((call) => call.node.callee.name === 'storiesOf')
      .filter((call) => call.node.arguments.length > 0 && call.node.arguments[0].type === LITERAL)
      .forEach((storiesOf) => {
        const title = storiesOf.node.arguments[0].value;
        statements.push(
          j.exportDefaultDeclaration(
            j.objectExpression([
              j.property('init', j.identifier('title'), j.literal(title)),
              ...extraExports,
            ])
          )
        );
      });

    // .add(...)
    const adds = [];
    base
      .find(j.CallExpression)
      .filter((add) => add.node.callee.property && add.node.callee.property.name === 'add')
      .filter((add) => add.node.arguments.length >= 2 && add.node.arguments[0].type === LITERAL)
      .forEach((add) => adds.push(add));

    adds.reverse();
    adds.push(path);

    const identifiers = new Set();
    root.find(j.Identifier).forEach(({ value }) => identifiers.add(value.name));
    adds.forEach((add) => {
      let name = add.node.arguments[0].value;
      let key = sanitizeName(name);
      while (identifiers.has(key)) {
        key = `_${key}`;
      }
      identifiers.add(key);
      if (storyNameFromExport(key) === name) {
        name = null;
      }

      const val = add.node.arguments[1];
      statements.push(
        j.exportDeclaration(
          false,
          j.variableDeclaration('const', [j.variableDeclarator(j.identifier(key), val)])
        )
      );

      const storyAnnotations = [];

      if (name) {
        storyAnnotations.push(j.property('init', j.identifier('name'), j.literal(name)));
      }

      if (add.node.arguments.length > 2) {
        const originalStoryParams = add.node.arguments[2];
        const { storyParams, storyDecorators } = extractDecorators(originalStoryParams);
        if (storyParams) {
          storyAnnotations.push(j.property('init', j.identifier('parameters'), storyParams));
        }
        if (storyDecorators) {
          storyAnnotations.push(j.property('init', j.identifier('decorators'), storyDecorators));
        }
      }

      if (storyAnnotations.length > 0) {
        statements.push(
          j.assignmentStatement(
            '=',
            j.memberExpression(j.identifier(key), j.identifier('story')),
            j.objectExpression(storyAnnotations)
          )
        );
      }
    });

    const stmt = path.parent.node.type === 'VariableDeclarator' ? path.parent.parent : path.parent;

    statements.reverse();
    statements.forEach((s) => stmt.insertAfter(s));
    j(stmt).remove();
  }

  // Save the original storiesOf
  const initialStoriesOf = root
    .find(j.CallExpression)
    .filter((call) => call.node.callee.name === 'storiesOf');

  const defaultExports = root.find(j.ExportDefaultDeclaration);
  // If there's already a default export
  if (defaultExports.size() > 0) {
    if (initialStoriesOf.size() > 0) {
      logger.warn(
        `Found ${initialStoriesOf.size()} 'storiesOf' calls but existing default export, SKIPPING: '${
          file.path
        }'`
      );
    }
    return root.toSource();
  }

  // Exclude all the original named exports
  const originalExports = [];
  root.find(j.ExportNamedDeclaration).forEach((exp) => {
    const { declaration, specifiers } = exp.node;
    if (declaration) {
      const { id, declarations } = declaration;
      if (declarations) {
        declarations.forEach((decl) => {
          const { name, properties } = decl.id;
          if (name) {
            originalExports.push(name);
          } else if (properties) {
            properties.forEach((prop) => originalExports.push(prop.key.name));
          }
        });
      } else if (id) {
        originalExports.push(id.name);
      }
    } else if (specifiers) {
      specifiers.forEach((spec) => originalExports.push(spec.exported.name));
    }
  });

  // each top-level add expression corresponds to the last "add" of the chain.
  // replace it with the entire export statements
  root
    .find(j.CallExpression)
    .filter((add) => add.node.callee.property && add.node.callee.property.name === 'add')
    .filter((add) => add.node.arguments.length >= 2 && add.node.arguments[0].type === LITERAL)
    .filter((add) =>
      ['ExpressionStatement', 'VariableDeclarator'].includes(add.parentPath.node.type)
    )
    .forEach((path) => convertToModuleExports(path, originalExports));

  // remove storiesOf import
  root
    .find(j.ImportSpecifier)
    .filter(
      (spec) =>
        spec.node.imported.name === 'storiesOf' &&
        spec.parent.node.source.value.startsWith('@storybook/')
    )
    .forEach((spec) => {
      const toRemove = spec.parent.node.specifiers.length > 1 ? spec : spec.parent;
      j(toRemove).remove();
    });

  const source = root.toSource({ trailingComma: true, quote: 'single', tabWidth: 2 });
  if (initialStoriesOf.size() > 1) {
    logger.warn(
      `Found ${initialStoriesOf.size()} 'storiesOf' calls, PLEASE FIX BY HAND: '${file.path}'`
    );
    return source;
  }

  let output = source;

  try {
    const prettierConfig = await prettier.resolveConfig(file.path);
    output = prettier.format(source, {
      ...prettierConfig,
      parser: jscodeshiftToPrettierParser(options.parser),
    });
  } catch (e) {
    logger.warn(`Failed to format ${file.path} with prettier`);
  }

  return output;
}
