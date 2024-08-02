import {
  parse,
  builtinResolvers as docgenResolver,
  builtinHandlers as docgenHandlers,
  makeFsImporter,
  ERROR_CODES,
  utils,
} from 'react-docgen';
import * as TsconfigPaths from 'tsconfig-paths';
import { findUp } from 'find-up';
import MagicString from 'magic-string';
import type { LoaderContext } from 'webpack';
import type { Handler, NodePath, babelTypes as t, Documentation } from 'react-docgen';
import { logger } from 'storybook/internal/node-logger';

import {
  RESOLVE_EXTENSIONS,
  ReactDocgenResolveError,
  defaultLookupModule,
} from './docgen-resolver';

const { getNameOrValue, isReactForwardRefCall } = utils;

const actualNameHandler: Handler = function actualNameHandler(documentation, componentDefinition) {
  documentation.set('definedInFile', componentDefinition.hub.file.opts.filename);
  if (
    (componentDefinition.isClassDeclaration() || componentDefinition.isFunctionDeclaration()) &&
    componentDefinition.has('id')
  ) {
    documentation.set(
      'actualName',
      getNameOrValue(componentDefinition.get('id') as NodePath<t.Identifier>)
    );
  } else if (
    componentDefinition.isArrowFunctionExpression() ||
    componentDefinition.isFunctionExpression() ||
    isReactForwardRefCall(componentDefinition)
  ) {
    let currentPath: NodePath = componentDefinition;

    while (currentPath.parentPath) {
      if (currentPath.parentPath.isVariableDeclarator()) {
        documentation.set('actualName', getNameOrValue(currentPath.parentPath.get('id')));
        return;
      }
      if (currentPath.parentPath.isAssignmentExpression()) {
        const leftPath = currentPath.parentPath.get('left');

        if (leftPath.isIdentifier() || leftPath.isLiteral()) {
          documentation.set('actualName', getNameOrValue(leftPath));
          return;
        }
      }

      currentPath = currentPath.parentPath;
    }
    // Could not find an actual name
    documentation.set('actualName', '');
  }
};

type DocObj = Documentation & { actualName: string; definedInFile: string };

const defaultHandlers = Object.values(docgenHandlers).map((handler) => handler);
const defaultResolver = new docgenResolver.FindExportedDefinitionsResolver();
const handlers = [...defaultHandlers, actualNameHandler];

let tsconfigPathsInitialized = false;
let matchPath: TsconfigPaths.MatchPath | undefined;

export default async function reactDocgenLoader(
  this: LoaderContext<{ debug: boolean }>,
  source: string,
  map: any
) {
  const callback = this.async();
  // get options
  const options = this.getOptions() || {};
  const { debug = false } = options;

  if (!tsconfigPathsInitialized) {
    const tsconfigPath = await findUp('tsconfig.json', { cwd: process.cwd() });
    const tsconfig = TsconfigPaths.loadConfig(tsconfigPath);

    if (tsconfig.resultType === 'success') {
      logger.info('Using tsconfig paths for react-docgen');
      matchPath = TsconfigPaths.createMatchPath(tsconfig.absoluteBaseUrl, tsconfig.paths, [
        'browser',
        'module',
        'main',
      ]);
    }

    tsconfigPathsInitialized = true;
  }

  try {
    const docgenResults = parse(source, {
      filename: this.resourcePath,
      resolver: defaultResolver,
      handlers,
      importer: getReactDocgenImporter(matchPath),
      babelOptions: {
        babelrc: false,
        configFile: false,
      },
    }) as DocObj[];

    const magicString = new MagicString(source);

    docgenResults.forEach((info) => {
      const { actualName, definedInFile, ...docgenInfo } = info;
      if (actualName && definedInFile == this.resourcePath) {
        const docNode = JSON.stringify(docgenInfo);
        magicString.append(`;${actualName}.__docgenInfo=${docNode}`);
      }
    });

    callback(
      null,
      magicString.toString(),
      map ??
        magicString.generateMap({
          hires: true,
          source: this.resourcePath,
          includeContent: true,
        })
    );
  } catch (error: any) {
    if (error.code === ERROR_CODES.MISSING_DEFINITION) {
      callback(null, source);
    } else {
      if (!debug) {
        logger.warn(
          `Failed to parse ${this.resourcePath} with react-docgen. Rerun Storybook with --loglevel=debug to get more info.`
        );
      } else {
        logger.warn(
          `Failed to parse ${this.resourcePath} with react-docgen. Please use the below error message and the content of the file which causes the error to report the issue to the maintainers of react-docgen. https://github.com/reactjs/react-docgen`
        );
        logger.error(error);
      }

      callback(null, source);
    }
  }
}

export function getReactDocgenImporter(matchingPath: TsconfigPaths.MatchPath | undefined) {
  return makeFsImporter((filename, basedir) => {
    const mappedFilenameByPaths = (() => {
      if (matchingPath) {
        const match = matchingPath(filename);
        return match || filename;
      } else {
        return filename;
      }
    })();

    const result = defaultLookupModule(mappedFilenameByPaths, basedir);

    if (RESOLVE_EXTENSIONS.find((ext) => result.endsWith(ext))) {
      return result;
    }

    throw new ReactDocgenResolveError(filename);
  });
}
