import { sanitize, storyNameFromExport } from '@storybook/csf';

import mapKeys from 'lodash/mapKeys.js';

import { extractSource } from '../extract-source';
import { patchNode } from './parse-helpers';
import getParser from './parsers';
import {
  findAddsMap,
  findExportsMap as generateExportsMap,
  popParametersObjectFromDefaultExport,
  splitExports,
  splitSTORYOF,
} from './traverse-helpers';

export function sanitizeSource(source) {
  return JSON.stringify(source, null, 2)
    .trim()
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function isUglyComment(comment, uglyCommentsRegex) {
  return uglyCommentsRegex.some((regex) => regex.test(comment));
}

function generateSourceWithoutUglyComments(source, { comments, uglyCommentsRegex }) {
  let lastIndex = 0;
  const parts = [source];

  comments
    .filter((comment) => isUglyComment(comment.value.trim(), uglyCommentsRegex))
    .map(patchNode)
    .forEach((comment) => {
      parts.pop();

      const start = source.slice(lastIndex, comment.start);
      const end = source.slice(comment.end);

      parts.push(start, end);
      lastIndex = comment.end;
    });

  return parts.join('');
}

function prettifyCode(source, { prettierConfig, parser, filepath }) {
  let config = prettierConfig;
  let foundParser = null;
  if (parser === 'flow') foundParser = 'flow';
  if (parser === 'javascript' || /jsx?/.test(parser)) foundParser = 'javascript';
  if (parser === 'typescript' || /tsx?/.test(parser)) foundParser = 'typescript';

  if (!config.parser) {
    config = {
      ...prettierConfig,
    };
  } else if (filepath) {
    config = {
      ...prettierConfig,
      filepath,
    };
  } else {
    config = {
      ...prettierConfig,
    };
  }

  try {
    return getParser(foundParser || 'javascript').format(source, config);
  } catch (e) {
    // Can fail when the source is a JSON
    return source;
  }
}

const ADD_PARAMETERS_STATEMENT =
  '.addParameters({ storySource: { source: __STORY__, locationsMap: __LOCATIONS_MAP__ } })';
const applyExportDecoratorStatement = (part) =>
  part.declaration.isVariableDeclaration
    ? ` ${part.source};`
    : ` const ${part.declaration.ident} = ${part.source};`;

export function generateSourceWithDecorators(source, ast) {
  const { comments = [] } = ast;

  const partsUsingStoryOfToken = splitSTORYOF(ast, source);

  if (partsUsingStoryOfToken.length > 1) {
    const newSource = partsUsingStoryOfToken.join(ADD_PARAMETERS_STATEMENT);

    return {
      storyOfTokenFound: true,
      changed: partsUsingStoryOfToken.length > 1,
      source: newSource,
      comments,
    };
  }

  const partsUsingExports = splitExports(ast, source);

  const newSource = partsUsingExports
    .map((part, i) => (i % 2 === 0 ? part.source : applyExportDecoratorStatement(part)))
    .join('');

  return {
    exportTokenFound: true,
    changed: partsUsingExports.length > 1,
    source: newSource,
    comments,
  };
}

export function generateSourceWithoutDecorators(source, ast) {
  const { comments = [] } = ast;

  return {
    changed: true,
    source,
    comments,
  };
}

export function generateAddsMap(ast, storiesOfIdentifiers) {
  return findAddsMap(ast, storiesOfIdentifiers);
}

export function generateStoriesLocationsMap(ast, storiesOfIdentifiers) {
  const usingAddsMap = generateAddsMap(ast, storiesOfIdentifiers);
  const addsMap = usingAddsMap;

  if (Object.keys(addsMap).length > 0) {
    return usingAddsMap;
  }
  const usingExportsMap = generateExportsMap(ast);

  return usingExportsMap || usingAddsMap;
}

export function generateStorySource({ source, ...options }) {
  let storySource = source;

  storySource = generateSourceWithoutUglyComments(storySource, options);
  storySource = prettifyCode(storySource, options);

  return storySource;
}

function transformLocationMapToIds(parameters) {
  if (!parameters?.locationsMap) return parameters;
  const locationsMap = mapKeys(parameters.locationsMap, (_value, key) => {
    return sanitize(storyNameFromExport(key));
  });
  return { ...parameters, locationsMap };
}

export function generateSourcesInExportedParameters(source, ast, additionalParameters) {
  const { splicedSource, parametersSliceOfCode, indexWhereToAppend, foundParametersProperty } =
    popParametersObjectFromDefaultExport(source, ast);
  if (indexWhereToAppend !== -1) {
    const additionalParametersAsJson = JSON.stringify(
      {
        storySource: transformLocationMapToIds(additionalParameters),
      },
      null,
      2
    )
      .trim()
      .slice(0, -1);
    const propertyDeclaration = foundParametersProperty ? '' : 'parameters: ';
    const comma = foundParametersProperty ? '' : ',';
    const newParameters = `${propertyDeclaration}${additionalParametersAsJson},${parametersSliceOfCode.substring(
      1
    )}${comma}`;
    const additionalComma = comma === ',' ? '' : ',';
    const result = `${splicedSource.substring(
      0,
      indexWhereToAppend
    )}${newParameters}${additionalComma}${splicedSource.substring(indexWhereToAppend)}`;
    return result;
  }
  return source;
}

function addStorySourceParameter(key, snippet) {
  const source = sanitizeSource(snippet);
  return `${key}.parameters = { storySource: { source: ${source} }, ...${key}.parameters };`;
}

export function generateSourcesInStoryParameters(source, ast, additionalParameters) {
  if (!additionalParameters || !additionalParameters.source || !additionalParameters.locationsMap) {
    return source;
  }
  const { source: sanitizedSource, locationsMap } = additionalParameters;
  const lines = sanitizedSource.split('\n');
  const suffix = Object.entries(locationsMap).reduce((acc, [exportName, location]) => {
    const exportSource = extractSource(location, lines);
    if (exportSource) {
      const generated = addStorySourceParameter(exportName, exportSource);
      return `${acc}\n${generated}`;
    }
    return acc;
  }, '');

  return suffix ? `${source}\n\n${suffix}` : source;
}
