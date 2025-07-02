/**
 * @license React react-server-dom-webpack-node-loader.production.js
 *
 *   Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 *   This source code is licensed under the MIT license found in the LICENSE file in the root
 *   directory of this source tree.
 */
import * as acorn from 'acorn-loose';
import createMappingsSerializer from 'webpack-sources/lib/helpers/createMappingsSerializer.js';
import readMappings from 'webpack-sources/lib/helpers/readMappings.js';

const assign = Object.assign;

let warnedAboutConditionsFlag = false;
let stashedGetSource = null;
let stashedResolve = null;
async function resolve(specifier, context, defaultResolve) {
  // We stash this in case we end up needing to resolve export * statements later.
  stashedResolve = defaultResolve;
  if (!context.conditions.includes('react-server')) {
    context = assign({}, context, {
      conditions: [].concat(context.conditions, ['react-server']),
    });
    if (!warnedAboutConditionsFlag) {
      warnedAboutConditionsFlag = true;
      console.warn(
        'You did not run Node.js with the `--conditions react-server` flag. ' +
          'Any "react-server" override will only work with ESM imports.'
      );
    }
  }
  return await defaultResolve(specifier, context, defaultResolve);
}
async function getSource(url, context, defaultGetSource) {
  // We stash this in case we end up needing to resolve export * statements later.
  stashedGetSource = defaultGetSource;
  return defaultGetSource(url, context, defaultGetSource);
}
function addExportedEntry(exportedEntries, localNames, localName, exportedName, type, loc) {
  if (localNames.has(localName)) {
    // If the same local name is exported more than once, we only need one of the names.
    return;
  }
  exportedEntries.push({
    localName,
    exportedName,
    type,
    loc,
    originalLine: -1,
    originalColumn: -1,
    originalSource: -1,
    nameIndex: -1,
  });
}
function addLocalExportedNames(exportedEntries, localNames, node) {
  switch (node.type) {
    case 'Identifier':
      addExportedEntry(exportedEntries, localNames, node.name, node.name, null, node.loc);
      return;
    case 'ObjectPattern':
      for (let i = 0; i < node.properties.length; i++) {
        addLocalExportedNames(exportedEntries, localNames, node.properties[i]);
      }
      return;
    case 'ArrayPattern':
      for (let i = 0; i < node.elements.length; i++) {
        const element = node.elements[i];

        if (element) {
          addLocalExportedNames(exportedEntries, localNames, element);
        }
      }
      return;
    case 'Property':
      addLocalExportedNames(exportedEntries, localNames, node.value);
      return;
    case 'AssignmentPattern':
      addLocalExportedNames(exportedEntries, localNames, node.left);
      return;
    case 'RestElement':
      addLocalExportedNames(exportedEntries, localNames, node.argument);
      return;
    case 'ParenthesizedExpression':
      addLocalExportedNames(exportedEntries, localNames, node.expression);
      return;
  }
}
function transformServerModule(source, program, url, sourceMap, loader) {
  const body = program.body;

  // This entry list needs to be in source location order.
  const exportedEntries = [];
  // Dedupe set.
  const localNames = new Set();
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    switch (node.type) {
      case 'ExportAllDeclaration':
        // If export * is used, the other file needs to explicitly opt into "use server" too.
        break;
      case 'ExportDefaultDeclaration':
        if (node.declaration.type === 'Identifier') {
          addExportedEntry(
            exportedEntries,
            localNames,
            node.declaration.name,
            'default',
            null,
            node.declaration.loc
          );
        } else if (node.declaration.type === 'FunctionDeclaration') {
          if (node.declaration.id) {
            addExportedEntry(
              exportedEntries,
              localNames,
              node.declaration.id.name,
              'default',
              'function',
              node.declaration.id.loc
            );
          }
        }
        continue;
      case 'ExportNamedDeclaration':
        if (node.declaration) {
          if (node.declaration.type === 'VariableDeclaration') {
            const declarations = node.declaration.declarations;
            for (let j = 0; j < declarations.length; j++) {
              addLocalExportedNames(exportedEntries, localNames, declarations[j].id);
            }
          } else {
            const name = node.declaration.id.name;
            addExportedEntry(
              exportedEntries,
              localNames,
              name,
              name,
              node.declaration.type === 'FunctionDeclaration' ? 'function' : null,
              node.declaration.id.loc
            );
          }
        }
        if (node.specifiers) {
          const specifiers = node.specifiers;
          for (let j = 0; j < specifiers.length; j++) {
            const specifier = specifiers[j];
            addExportedEntry(
              exportedEntries,
              localNames,
              specifier.local.name,
              specifier.exported.name,
              null,
              specifier.local.loc
            );
          }
        }
        continue;
    }
  }
  let mappings = sourceMap && typeof sourceMap.mappings === 'string' ? sourceMap.mappings : '';
  let newSrc = source;
  if (exportedEntries.length > 0) {
    let lastSourceIndex = 0;
    let lastOriginalLine = 0;
    let lastOriginalColumn = 0;
    let lastNameIndex = 0;
    let sourceLineCount = 0;
    let lastMappedLine = 0;
    if (sourceMap) {
      // We iterate source mapping entries and our matched exports in parallel to source map
      // them to their original location.
      let nextEntryIdx = 0;
      let nextEntryLine = exportedEntries[nextEntryIdx].loc.start.line;
      let nextEntryColumn = exportedEntries[nextEntryIdx].loc.start.column;
      readMappings(
        mappings,
        (generatedLine, generatedColumn, sourceIndex, originalLine, originalColumn, nameIndex) => {
          if (
            generatedLine > nextEntryLine ||
            (generatedLine === nextEntryLine && generatedColumn > nextEntryColumn)
          ) {
            // We're past the entry which means that the best match we have is the previous entry.
            if (lastMappedLine === nextEntryLine) {
              // Match
              exportedEntries[nextEntryIdx].originalLine = lastOriginalLine;
              exportedEntries[nextEntryIdx].originalColumn = lastOriginalColumn;
              exportedEntries[nextEntryIdx].originalSource = lastSourceIndex;
              exportedEntries[nextEntryIdx].nameIndex = lastNameIndex;
            }
            nextEntryIdx++;
            if (nextEntryIdx < exportedEntries.length) {
              nextEntryLine = exportedEntries[nextEntryIdx].loc.start.line;
              nextEntryColumn = exportedEntries[nextEntryIdx].loc.start.column;
            } else {
              nextEntryLine = -1;
              nextEntryColumn = -1;
            }
          }
          lastMappedLine = generatedLine;
          if (sourceIndex > -1) {
            lastSourceIndex = sourceIndex;
          }
          if (originalLine > -1) {
            lastOriginalLine = originalLine;
          }
          if (originalColumn > -1) {
            lastOriginalColumn = originalColumn;
          }
          if (nameIndex > -1) {
            lastNameIndex = nameIndex;
          }
        }
      );
      if (nextEntryIdx < exportedEntries.length) {
        if (lastMappedLine === nextEntryLine) {
          // Match
          exportedEntries[nextEntryIdx].originalLine = lastOriginalLine;
          exportedEntries[nextEntryIdx].originalColumn = lastOriginalColumn;
          exportedEntries[nextEntryIdx].originalSource = lastSourceIndex;
          exportedEntries[nextEntryIdx].nameIndex = lastNameIndex;
        }
      }
      for (
        let lastIdx = mappings.length - 1;
        lastIdx >= 0 && mappings[lastIdx] === ';';
        lastIdx--
      ) {
        // If the last mapped lines don't contain any segments, we don't get a callback from readMappings
        // so we need to pad the number of mapped lines, with one for each empty line.
        lastMappedLine++;
      }
      sourceLineCount = program.loc.end.line;
      if (sourceLineCount < lastMappedLine) {
        throw new Error('The source map has more mappings than there are lines.');
      }
      // If the original source string had more lines than there are mappings in the source map.
      // Add some extra padding of unmapped lines so that any lines that we add line up.
      for (let extraLines = sourceLineCount - lastMappedLine; extraLines > 0; extraLines--) {
        mappings += ';';
      }
    } else {
      // If a file doesn't have a source map then we generate a blank source map that just
      // contains the original content and segments pointing to the original lines.
      sourceLineCount = 1;
      let idx = -1;
      while ((idx = source.indexOf('\n', idx + 1)) !== -1) {
        sourceLineCount++;
      }
      mappings = 'AAAA' + ';AACA'.repeat(sourceLineCount - 1);
      sourceMap = {
        version: 3,
        sources: [url],
        sourcesContent: [source],
        mappings: mappings,
        sourceRoot: '',
      };
      lastSourceIndex = 0;
      lastOriginalLine = sourceLineCount;
      lastOriginalColumn = 0;
      lastNameIndex = -1;
      lastMappedLine = sourceLineCount;
      for (let i = 0; i < exportedEntries.length; i++) {
        // Point each entry to original location.
        const entry = exportedEntries[i];
        entry.originalSource = 0;
        entry.originalLine = entry.loc.start.line;
        // We use column zero since we do the short-hand line-only source maps above.
        entry.originalColumn = 0; // entry.loc.start.column;
      }
    }
    newSrc += '\n\n;';
    newSrc += 'import {registerServerReference} from "react-server-dom-webpack/server";\n';
    if (mappings) {
      mappings += ';;';
    }
    const createMapping = createMappingsSerializer();

    // Create an empty mapping pointing to where we last left off to reset the counters.
    let generatedLine = 1;
    createMapping(
      generatedLine,
      0,
      lastSourceIndex,
      lastOriginalLine,
      lastOriginalColumn,
      lastNameIndex
    );
    for (let i = 0; i < exportedEntries.length; i++) {
      const entry = exportedEntries[i];
      generatedLine++;
      if (entry.type !== 'function') {
        // We first check if the export is a function and if so annotate it.
        newSrc += 'if (typeof ' + entry.localName + ' === "function") ';
      }
      newSrc += 'registerServerReference(' + entry.localName + ',';
      newSrc += JSON.stringify(url) + ',';
      newSrc += JSON.stringify(entry.exportedName) + ');\n';
      mappings += createMapping(
        generatedLine,
        0,
        entry.originalSource,
        entry.originalLine,
        entry.originalColumn,
        entry.nameIndex
      );
    }
  }
  if (sourceMap) {
    // Override with an new mappings and serialize an inline source map.
    sourceMap.mappings = mappings;
    newSrc +=
      '//# sourceMappingURL=data:application/json;charset=utf-8;base64,' +
      Buffer.from(JSON.stringify(sourceMap)).toString('base64');
  }
  return newSrc;
}
function addExportNames(names, node) {
  switch (node.type) {
    case 'Identifier':
      names.push(node.name);
      return;
    case 'ObjectPattern':
      for (let i = 0; i < node.properties.length; i++) {
        addExportNames(names, node.properties[i]);
      }
      return;
    case 'ArrayPattern':
      for (let i = 0; i < node.elements.length; i++) {
        const element = node.elements[i];

        if (element) {
          addExportNames(names, element);
        }
      }
      return;
    case 'Property':
      addExportNames(names, node.value);
      return;
    case 'AssignmentPattern':
      addExportNames(names, node.left);
      return;
    case 'RestElement':
      addExportNames(names, node.argument);
      return;
    case 'ParenthesizedExpression':
      addExportNames(names, node.expression);
      return;
  }
}
function resolveClientImport(specifier, parentURL) {
  // Resolve an import specifier as if it was loaded by the client. This doesn't use
  // the overrides that this loader does but instead reverts to the default.
  // This resolution algorithm will not necessarily have the same configuration
  // as the actual client loader. It should mostly work and if it doesn't you can
  // always convert to explicit exported names instead.
  const conditions = ['node', 'import'];
  if (stashedResolve === null) {
    throw new Error('Expected resolve to have been called before transformSource');
  }
  return stashedResolve(
    specifier,
    {
      conditions,
      parentURL,
    },
    stashedResolve
  );
}
async function parseExportNamesInto(body, names, parentURL, loader) {
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    switch (node.type) {
      case 'ExportAllDeclaration':
        if (node.exported) {
          addExportNames(names, node.exported);
          continue;
        } else {
          const _await$resolveClientI = await resolveClientImport(node.source.value, parentURL),
            url = _await$resolveClientI.url;
          const _await$loader = await loader(
              url,
              {
                format: 'module',
                conditions: [],
                importAssertions: {},
              },
              loader
            ),
            source = _await$loader.source;
          if (typeof source !== 'string') {
            throw new Error('Expected the transformed source to be a string.');
          }
          let childBody;
          try {
            childBody = acorn.parse(source, {
              ecmaVersion: '2024',
              sourceType: 'module',
            }).body;
          } catch (x) {
            console.error('Error parsing %s %s', url, x.message);
            continue;
          }
          await parseExportNamesInto(childBody, names, url, loader);
          continue;
        }
      case 'ExportDefaultDeclaration':
        names.push('default');
        continue;
      case 'ExportNamedDeclaration':
        if (node.declaration) {
          if (node.declaration.type === 'VariableDeclaration') {
            const declarations = node.declaration.declarations;
            for (let j = 0; j < declarations.length; j++) {
              addExportNames(names, declarations[j].id);
            }
          } else {
            addExportNames(names, node.declaration.id);
          }
        }
        if (node.specifiers) {
          const specifiers = node.specifiers;
          for (let j = 0; j < specifiers.length; j++) {
            addExportNames(names, specifiers[j].exported);
          }
        }
        continue;
    }
  }
}
async function transformClientModule(program, url, sourceMap, loader) {
  const body = program.body;
  const names = [];
  await parseExportNamesInto(body, names, url, loader);
  if (names.length === 0) {
    return '';
  }
  let newSrc = 'import {registerClientReference} from "react-server-dom-webpack/server";\n';
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (name === 'default') {
      newSrc += 'export default ';
      newSrc += 'registerClientReference(function() {';
      newSrc +=
        'throw new Error(' +
        JSON.stringify(
          'Attempted to call the default export of ' +
            url +
            ' from the server ' +
            "but it's on the client. It's not possible to invoke a client function from " +
            'the server, it can only be rendered as a Component or passed to props of a ' +
            'Client Component.'
        ) +
        ');';
    } else {
      newSrc += 'export const ' + name + ' = ';
      newSrc += 'registerClientReference(function() {';
      newSrc +=
        'throw new Error(' +
        JSON.stringify(
          'Attempted to call ' +
            name +
            '() from the server but ' +
            name +
            ' is on the client. ' +
            "It's not possible to invoke a client function from the server, it can " +
            'only be rendered as a Component or passed to props of a Client Component.'
        ) +
        ');';
    }
    newSrc += '},';
    newSrc += JSON.stringify(url) + ',';
    newSrc += JSON.stringify(name) + ');\n';
  }

  // TODO: Generate source maps for Client Reference functions so they can point to their
  // original locations.
  return newSrc;
}
async function loadClientImport(url, defaultTransformSource) {
  if (stashedGetSource === null) {
    throw new Error('Expected getSource to have been called before transformSource');
  }
  // TODO: Validate that this is another module by calling getFormat.
  const _await$stashedGetSour = await stashedGetSource(
      url,
      {
        format: 'module',
      },
      stashedGetSource
    ),
    source = _await$stashedGetSour.source;
  const result = await defaultTransformSource(
    source,
    {
      format: 'module',
      url,
    },
    defaultTransformSource
  );
  return {
    format: 'module',
    source: result.source,
  };
}
async function transformModuleIfNeeded(source, url, loader) {
  // Do a quick check for the exact string. If it doesn't exist, don't
  // bother parsing.
  if (source.indexOf('use client') === -1 && source.indexOf('use server') === -1) {
    return source;
  }
  let sourceMappingURL = null;
  let sourceMappingStart = 0;
  let sourceMappingEnd = 0;
  let sourceMappingLines = 0;
  let program;
  try {
    program = acorn.parse(source, {
      ecmaVersion: '2024',
      sourceType: 'module',
      locations: true,
      onComment(block, text, start, end, startLoc, endLoc) {
        if (text.startsWith('# sourceMappingURL=') || text.startsWith('@ sourceMappingURL=')) {
          sourceMappingURL = text.slice(19);
          sourceMappingStart = start;
          sourceMappingEnd = end;
          sourceMappingLines = endLoc.line - startLoc.line;
        }
      },
    });
  } catch (x) {
    console.error('Error parsing %s %s', url, x.message);
    return source;
  }
  let useClient = false;
  let useServer = false;
  const body = program.body;
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    if (node.type !== 'ExpressionStatement' || !node.directive) {
      break;
    }
    if (node.directive === 'use client') {
      useClient = true;
    }
    if (node.directive === 'use server') {
      useServer = true;
    }
  }
  if (!useClient && !useServer) {
    return source;
  }
  if (useClient && useServer) {
    throw new Error('Cannot have both "use client" and "use server" directives in the same file.');
  }
  let sourceMap = null;
  if (sourceMappingURL) {
    const sourceMapResult = await loader(
      sourceMappingURL,
      // $FlowFixMe
      {
        format: 'json',
        conditions: [],
        importAssertions: {
          type: 'json',
        },
        importAttributes: {
          type: 'json',
        },
      },
      loader
    );
    const sourceMapString =
      typeof sourceMapResult.source === 'string'
        ? sourceMapResult.source
        : // $FlowFixMe
          sourceMapResult.source.toString('utf8');
    sourceMap = JSON.parse(sourceMapString);

    // Strip the source mapping comment. We'll re-add it below if needed.
    source =
      source.slice(0, sourceMappingStart) +
      '\n'.repeat(sourceMappingLines) +
      source.slice(sourceMappingEnd);
  }
  if (useClient) {
    return transformClientModule(program, url, sourceMap, loader);
  }
  return transformServerModule(source, program, url, sourceMap);
}
async function transformSource(source, context, defaultTransformSource) {
  const transformed = await defaultTransformSource(source, context, defaultTransformSource);
  if (context.format === 'module') {
    const transformedSource = transformed.source;
    if (typeof transformedSource !== 'string') {
      throw new Error('Expected source to have been transformed to a string.');
    }
    const newSrc = await transformModuleIfNeeded(
      transformedSource,
      context.url,
      (url, ctx, defaultLoad) => {
        return loadClientImport(url, defaultTransformSource);
      }
    );
    return {
      source: newSrc,
    };
  }
  return transformed;
}
async function load(url, context, defaultLoad) {
  const result = await defaultLoad(url, context, defaultLoad);
  if (result.format === 'module') {
    if (typeof result.source !== 'string') {
      throw new Error('Expected source to have been loaded into a string.');
    }
    const newSrc = await transformModuleIfNeeded(result.source, url, defaultLoad);
    return {
      format: 'module',
      source: newSrc,
    };
  }
  return result;
}

export { getSource, load, resolve, transformSource };
