/*
  @license
	Rollup.js v4.18.0
	Wed, 22 May 2024 05:03:09 GMT - commit bb6f069ea3623b0297ef3895f2dcb98a2ca5ef58

	https://github.com/rollup/rollup

	Released under the MIT License.
*/
'use strict';

const native_js = require('../native.js');
const path = require('node:path');

/** @typedef {import('./types').Location} Location */

/**
 * @param {import('./types').Range} range
 * @param {number} index
 */
function rangeContains(range, index) {
	return range.start <= index && index < range.end;
}

/**
 * @param {string} source
 * @param {import('./types').Options} [options]
 */
function getLocator(source, options = {}) {
	const { offsetLine = 0, offsetColumn = 0 } = options;

	let start = 0;
	const ranges = source.split('\n').map((line, i) => {
		const end = start + line.length + 1;

		/** @type {import('./types').Range} */
		const range = { start, end, line: i };

		start = end;
		return range;
	});

	let i = 0;

	/**
	 * @param {string | number} search
	 * @param {number} [index]
	 * @returns {Location | undefined}
	 */
	function locator(search, index) {
		if (typeof search === 'string') {
			search = source.indexOf(search, index ?? 0);
		}

		if (search === -1) return undefined;

		let range = ranges[i];

		const d = search >= range.end ? 1 : -1;

		while (range) {
			if (rangeContains(range, search)) {
				return {
					line: offsetLine + range.line,
					column: offsetColumn + search - range.start,
					character: search
				};
			}

			i += d;
			range = ranges[i];
		}
	}

	return locator;
}

/**
 * @param {string} source
 * @param {string | number} search
 * @param {import('./types').Options} [options]
 * @returns {Location | undefined}
 */
function locate(source, search, options) {
	return getLocator(source, options)(search, options && options.startIndex);
}

function spaces(index) {
    let result = '';
    while (index--)
        result += ' ';
    return result;
}
function tabsToSpaces(value) {
    return value.replace(/^\t+/, match => match.split('\t').join('  '));
}
const LINE_TRUNCATE_LENGTH = 120;
const MIN_CHARACTERS_SHOWN_AFTER_LOCATION = 10;
const ELLIPSIS = '...';
function getCodeFrame(source, line, column) {
    let lines = source.split('\n');
    // Needed if a plugin did not generate correct sourcemaps
    if (line > lines.length)
        return '';
    const maxLineLength = Math.max(tabsToSpaces(lines[line - 1].slice(0, column)).length +
        MIN_CHARACTERS_SHOWN_AFTER_LOCATION +
        ELLIPSIS.length, LINE_TRUNCATE_LENGTH);
    const frameStart = Math.max(0, line - 3);
    let frameEnd = Math.min(line + 2, lines.length);
    lines = lines.slice(frameStart, frameEnd);
    while (!/\S/.test(lines[lines.length - 1])) {
        lines.pop();
        frameEnd -= 1;
    }
    const digits = String(frameEnd).length;
    return lines
        .map((sourceLine, index) => {
        const isErrorLine = frameStart + index + 1 === line;
        let lineNumber = String(index + frameStart + 1);
        while (lineNumber.length < digits)
            lineNumber = ` ${lineNumber}`;
        let displayedLine = tabsToSpaces(sourceLine);
        if (displayedLine.length > maxLineLength) {
            displayedLine = `${displayedLine.slice(0, maxLineLength - ELLIPSIS.length)}${ELLIPSIS}`;
        }
        if (isErrorLine) {
            const indicator = spaces(digits + 2 + tabsToSpaces(sourceLine.slice(0, column)).length) + '^';
            return `${lineNumber}: ${displayedLine}\n${indicator}`;
        }
        return `${lineNumber}: ${displayedLine}`;
    })
        .join('\n');
}

const LOGLEVEL_SILENT = 'silent';
const LOGLEVEL_ERROR = 'error';
const LOGLEVEL_WARN = 'warn';
const LOGLEVEL_INFO = 'info';
const LOGLEVEL_DEBUG = 'debug';
const logLevelPriority = {
    [LOGLEVEL_DEBUG]: 0,
    [LOGLEVEL_INFO]: 1,
    [LOGLEVEL_SILENT]: 3,
    [LOGLEVEL_WARN]: 2
};

const ABSOLUTE_PATH_REGEX = /^(?:\/|(?:[A-Za-z]:)?[/\\|])/;
const RELATIVE_PATH_REGEX = /^\.?\.(\/|$)/;
function isAbsolute(path) {
    return ABSOLUTE_PATH_REGEX.test(path);
}
function isRelative(path) {
    return RELATIVE_PATH_REGEX.test(path);
}
const BACKSLASH_REGEX = /\\/g;
function normalize(path) {
    return path.replace(BACKSLASH_REGEX, '/');
}

function printQuotedStringList(list, verbs) {
    const isSingleItem = list.length <= 1;
    const quotedList = list.map(item => `"${item}"`);
    let output = isSingleItem
        ? quotedList[0]
        : `${quotedList.slice(0, -1).join(', ')} and ${quotedList.slice(-1)[0]}`;
    if (verbs) {
        output += ` ${isSingleItem ? verbs[0] : verbs[1]}`;
    }
    return output;
}

const ANY_SLASH_REGEX = /[/\\]/;
function relative(from, to) {
    const fromParts = from.split(ANY_SLASH_REGEX).filter(Boolean);
    const toParts = to.split(ANY_SLASH_REGEX).filter(Boolean);
    if (fromParts[0] === '.')
        fromParts.shift();
    if (toParts[0] === '.')
        toParts.shift();
    while (fromParts[0] && toParts[0] && fromParts[0] === toParts[0]) {
        fromParts.shift();
        toParts.shift();
    }
    while (toParts[0] === '..' && fromParts.length > 0) {
        toParts.shift();
        fromParts.pop();
    }
    while (fromParts.pop()) {
        toParts.unshift('..');
    }
    return toParts.join('/');
}

function getAliasName(id) {
    const base = path.basename(id);
    return base.slice(0, Math.max(0, base.length - path.extname(id).length));
}
function relativeId(id) {
    if (!isAbsolute(id))
        return id;
    return relative(path.resolve(), id);
}
function isPathFragment(name) {
    // starting with "/", "./", "../", "C:/"
    return (name[0] === '/' || (name[0] === '.' && (name[1] === '/' || name[1] === '.')) || isAbsolute(name));
}
const UPPER_DIR_REGEX = /^(\.\.\/)*\.\.$/;
function getImportPath(importerId, targetPath, stripJsExtension, ensureFileName) {
    while (targetPath.startsWith('../')) {
        targetPath = targetPath.slice(3);
        importerId = '_/' + importerId;
    }
    let relativePath = normalize(relative(path.dirname(importerId), targetPath));
    if (stripJsExtension && relativePath.endsWith('.js')) {
        relativePath = relativePath.slice(0, -3);
    }
    if (ensureFileName) {
        if (relativePath === '')
            return '../' + path.basename(targetPath);
        if (UPPER_DIR_REGEX.test(relativePath)) {
            return [...relativePath.split('/'), '..', path.basename(targetPath)].join('/');
        }
    }
    return relativePath ? (relativePath.startsWith('..') ? relativePath : './' + relativePath) : '.';
}

function isValidUrl(url) {
    try {
        new URL(url);
    }
    catch {
        return false;
    }
    return true;
}
function getRollupUrl(snippet) {
    return `https://rollupjs.org/${snippet}`;
}
function addTrailingSlashIfMissed(url) {
    if (!url.endsWith('/')) {
        return url + '/';
    }
    return url;
}

// troubleshooting
const URL_AVOIDING_EVAL = 'troubleshooting/#avoiding-eval';
const URL_NAME_IS_NOT_EXPORTED = 'troubleshooting/#error-name-is-not-exported-by-module';
const URL_THIS_IS_UNDEFINED = 'troubleshooting/#error-this-is-undefined';
const URL_TREATING_MODULE_AS_EXTERNAL_DEPENDENCY = 'troubleshooting/#warning-treating-module-as-external-dependency';
const URL_SOURCEMAP_IS_LIKELY_TO_BE_INCORRECT = 'troubleshooting/#warning-sourcemap-is-likely-to-be-incorrect';
const URL_OUTPUT_AMD_ID = 'configuration-options/#output-amd-id';
const URL_OUTPUT_AMD_BASEPATH = 'configuration-options/#output-amd-basepath';
const URL_OUTPUT_DIR = 'configuration-options/#output-dir';
const URL_OUTPUT_EXPORTS = 'configuration-options/#output-exports';
const URL_OUTPUT_EXTEND = 'configuration-options/#output-extend';
const URL_OUTPUT_EXTERNALIMPORTATTRIBUTES = 'configuration-options/#output-externalimportattributes';
const URL_OUTPUT_FORMAT = 'configuration-options/#output-format';
const URL_OUTPUT_GENERATEDCODE = 'configuration-options/#output-generatedcode';
const URL_OUTPUT_GLOBALS = 'configuration-options/#output-globals';
const URL_OUTPUT_INLINEDYNAMICIMPORTS = 'configuration-options/#output-inlinedynamicimports';
const URL_OUTPUT_INTEROP = 'configuration-options/#output-interop';
const URL_OUTPUT_MANUALCHUNKS = 'configuration-options/#output-manualchunks';
const URL_OUTPUT_NAME = 'configuration-options/#output-name';
const URL_OUTPUT_SOURCEMAPBASEURL = 'configuration-options/#output-sourcemapbaseurl';
const URL_OUTPUT_SOURCEMAPFILE = 'configuration-options/#output-sourcemapfile';
const URL_PRESERVEENTRYSIGNATURES = 'configuration-options/#preserveentrysignatures';
const URL_TREESHAKE = 'configuration-options/#treeshake';
const URL_TREESHAKE_PURE = 'configuration-options/#pure';
const URL_TREESHAKE_NOSIDEEFFECTS = 'configuration-options/#no-side-effects';
const URL_TREESHAKE_MODULESIDEEFFECTS = 'configuration-options/#treeshake-modulesideeffects';
const URL_WATCH = 'configuration-options/#watch';
// command-line-interface
const URL_BUNDLE_CONFIG_AS_CJS = 'command-line-interface/#bundleconfigascjs';
const URL_CONFIGURATION_FILES = 'command-line-interface/#configuration-files';

function error(base) {
    throw base instanceof Error ? base : getRollupError(base);
}
function getRollupError(base) {
    augmentLogMessage(base);
    const errorInstance = Object.assign(new Error(base.message), base);
    Object.defineProperty(errorInstance, 'name', {
        value: 'RollupError',
        writable: true
    });
    return errorInstance;
}
function augmentCodeLocation(properties, pos, source, id) {
    if (typeof pos === 'object') {
        const { line, column } = pos;
        properties.loc = { column, file: id, line };
    }
    else {
        properties.pos = pos;
        const location = locate(source, pos, { offsetLine: 1 });
        if (!location) {
            return;
        }
        const { line, column } = location;
        properties.loc = { column, file: id, line };
    }
    if (properties.frame === undefined) {
        const { line, column } = properties.loc;
        properties.frame = getCodeFrame(source, line, column);
    }
}
const symbolAugmented = Symbol('augmented');
function augmentLogMessage(log) {
    // Make sure to only augment the log message once
    if (!(log.plugin || log.loc) || log[symbolAugmented]) {
        return;
    }
    log[symbolAugmented] = true;
    let prefix = '';
    if (log.plugin) {
        prefix += `[plugin ${log.plugin}] `;
    }
    const id = log.id || log.loc?.file;
    if (id) {
        const position = log.loc ? ` (${log.loc.line}:${log.loc.column})` : '';
        prefix += `${relativeId(id)}${position}: `;
    }
    log.message = prefix + log.message;
}
// Error codes should be sorted alphabetically while errors should be sorted by
// error code below
const ADDON_ERROR = 'ADDON_ERROR', ALREADY_CLOSED = 'ALREADY_CLOSED', AMBIGUOUS_EXTERNAL_NAMESPACES = 'AMBIGUOUS_EXTERNAL_NAMESPACES', ANONYMOUS_PLUGIN_CACHE = 'ANONYMOUS_PLUGIN_CACHE', ASSET_NOT_FINALISED = 'ASSET_NOT_FINALISED', ASSET_NOT_FOUND = 'ASSET_NOT_FOUND', ASSET_SOURCE_ALREADY_SET = 'ASSET_SOURCE_ALREADY_SET', ASSET_SOURCE_MISSING = 'ASSET_SOURCE_MISSING', BAD_LOADER = 'BAD_LOADER', CANNOT_CALL_NAMESPACE = 'CANNOT_CALL_NAMESPACE', CANNOT_EMIT_FROM_OPTIONS_HOOK = 'CANNOT_EMIT_FROM_OPTIONS_HOOK', CHUNK_NOT_GENERATED = 'CHUNK_NOT_GENERATED', CHUNK_INVALID = 'CHUNK_INVALID', CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY', CIRCULAR_REEXPORT = 'CIRCULAR_REEXPORT', CONST_REASSIGN = 'CONST_REASSIGN', CYCLIC_CROSS_CHUNK_REEXPORT = 'CYCLIC_CROSS_CHUNK_REEXPORT', DEPRECATED_FEATURE = 'DEPRECATED_FEATURE', DUPLICATE_ARGUMENT_NAME = 'DUPLICATE_ARGUMENT_NAME', DUPLICATE_EXPORT = 'DUPLICATE_EXPORT', DUPLICATE_IMPORT_OPTIONS = 'DUPLICATE_IMPORT_OPTIONS', DUPLICATE_PLUGIN_NAME = 'DUPLICATE_PLUGIN_NAME', EMPTY_BUNDLE = 'EMPTY_BUNDLE', EVAL = 'EVAL', EXTERNAL_MODULES_CANNOT_BE_INCLUDED_IN_MANUAL_CHUNKS = 'EXTERNAL_MODULES_CANNOT_BE_INCLUDED_IN_MANUAL_CHUNKS', EXTERNAL_MODULES_CANNOT_BE_TRANSFORMED_TO_MODULES = 'EXTERNAL_MODULES_CANNOT_BE_TRANSFORMED_TO_MODULES', EXTERNAL_SYNTHETIC_EXPORTS = 'EXTERNAL_SYNTHETIC_EXPORTS', FAIL_AFTER_WARNINGS = 'FAIL_AFTER_WARNINGS', FILE_NAME_CONFLICT = 'FILE_NAME_CONFLICT', FILE_NOT_FOUND = 'FILE_NOT_FOUND', FIRST_SIDE_EFFECT = 'FIRST_SIDE_EFFECT', ILLEGAL_IDENTIFIER_AS_NAME = 'ILLEGAL_IDENTIFIER_AS_NAME', ILLEGAL_REASSIGNMENT = 'ILLEGAL_REASSIGNMENT', INCONSISTENT_IMPORT_ATTRIBUTES = 'INCONSISTENT_IMPORT_ATTRIBUTES', INVALID_ANNOTATION = 'INVALID_ANNOTATION', INPUT_HOOK_IN_OUTPUT_PLUGIN = 'INPUT_HOOK_IN_OUTPUT_PLUGIN', INVALID_CHUNK = 'INVALID_CHUNK', INVALID_CONFIG_MODULE_FORMAT = 'INVALID_CONFIG_MODULE_FORMAT', INVALID_EXPORT_OPTION = 'INVALID_EXPORT_OPTION', INVALID_EXTERNAL_ID = 'INVALID_EXTERNAL_ID', INVALID_IMPORT_ATTRIBUTE = 'INVALID_IMPORT_ATTRIBUTE', INVALID_LOG_POSITION = 'INVALID_LOG_POSITION', INVALID_OPTION = 'INVALID_OPTION', INVALID_PLUGIN_HOOK = 'INVALID_PLUGIN_HOOK', INVALID_ROLLUP_PHASE = 'INVALID_ROLLUP_PHASE', INVALID_SETASSETSOURCE = 'INVALID_SETASSETSOURCE', INVALID_TLA_FORMAT = 'INVALID_TLA_FORMAT', MISSING_CONFIG = 'MISSING_CONFIG', MISSING_EXPORT = 'MISSING_EXPORT', MISSING_EXTERNAL_CONFIG = 'MISSING_EXTERNAL_CONFIG', MISSING_GLOBAL_NAME = 'MISSING_GLOBAL_NAME', MISSING_IMPLICIT_DEPENDANT = 'MISSING_IMPLICIT_DEPENDANT', MISSING_NAME_OPTION_FOR_IIFE_EXPORT = 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT', MISSING_NODE_BUILTINS = 'MISSING_NODE_BUILTINS', MISSING_OPTION = 'MISSING_OPTION', MIXED_EXPORTS = 'MIXED_EXPORTS', MODULE_LEVEL_DIRECTIVE = 'MODULE_LEVEL_DIRECTIVE', NAMESPACE_CONFLICT = 'NAMESPACE_CONFLICT', NO_TRANSFORM_MAP_OR_AST_WITHOUT_CODE = 'NO_TRANSFORM_MAP_OR_AST_WITHOUT_CODE', ONLY_INLINE_SOURCEMAPS = 'ONLY_INLINE_SOURCEMAPS', OPTIMIZE_CHUNK_STATUS = 'OPTIMIZE_CHUNK_STATUS', PARSE_ERROR = 'PARSE_ERROR', PLUGIN_ERROR = 'PLUGIN_ERROR', REDECLARATION_ERROR = 'REDECLARATION_ERROR', SHIMMED_EXPORT = 'SHIMMED_EXPORT', SOURCEMAP_BROKEN = 'SOURCEMAP_BROKEN', SOURCEMAP_ERROR = 'SOURCEMAP_ERROR', SYNTHETIC_NAMED_EXPORTS_NEED_NAMESPACE_EXPORT = 'SYNTHETIC_NAMED_EXPORTS_NEED_NAMESPACE_EXPORT', THIS_IS_UNDEFINED = 'THIS_IS_UNDEFINED', UNEXPECTED_NAMED_IMPORT = 'UNEXPECTED_NAMED_IMPORT', UNKNOWN_OPTION = 'UNKNOWN_OPTION', UNRESOLVED_ENTRY = 'UNRESOLVED_ENTRY', UNRESOLVED_IMPORT = 'UNRESOLVED_IMPORT', UNUSED_EXTERNAL_IMPORT = 'UNUSED_EXTERNAL_IMPORT', VALIDATION_ERROR = 'VALIDATION_ERROR';
function logAddonNotGenerated(message, hook, plugin) {
    return {
        code: ADDON_ERROR,
        message: `Could not retrieve "${hook}". Check configuration of plugin "${plugin}".
\tError Message: ${message}`
    };
}
function logAlreadyClosed() {
    return {
        code: ALREADY_CLOSED,
        message: 'Bundle is already closed, no more calls to "generate" or "write" are allowed.'
    };
}
function logAmbiguousExternalNamespaces(binding, reexportingModule, usedModule, sources) {
    return {
        binding,
        code: AMBIGUOUS_EXTERNAL_NAMESPACES,
        ids: sources,
        message: `Ambiguous external namespace resolution: "${relativeId(reexportingModule)}" re-exports "${binding}" from one of the external modules ${printQuotedStringList(sources.map(module => relativeId(module)))}, guessing "${relativeId(usedModule)}".`,
        reexporter: reexportingModule
    };
}
function logAnonymousPluginCache() {
    return {
        code: ANONYMOUS_PLUGIN_CACHE,
        message: 'A plugin is trying to use the Rollup cache but is not declaring a plugin name or cacheKey.'
    };
}
function logAssetNotFinalisedForFileName(name) {
    return {
        code: ASSET_NOT_FINALISED,
        message: `Plugin error - Unable to get file name for asset "${name}". Ensure that the source is set and that generate is called first. If you reference assets via import.meta.ROLLUP_FILE_URL_<referenceId>, you need to either have set their source after "renderStart" or need to provide an explicit "fileName" when emitting them.`
    };
}
function logAssetReferenceIdNotFoundForSetSource(assetReferenceId) {
    return {
        code: ASSET_NOT_FOUND,
        message: `Plugin error - Unable to set the source for unknown asset "${assetReferenceId}".`
    };
}
function logAssetSourceAlreadySet(name) {
    return {
        code: ASSET_SOURCE_ALREADY_SET,
        message: `Unable to set the source for asset "${name}", source already set.`
    };
}
function logNoAssetSourceSet(assetName) {
    return {
        code: ASSET_SOURCE_MISSING,
        message: `Plugin error creating asset "${assetName}" - no asset source set.`
    };
}
function logBadLoader(id) {
    return {
        code: BAD_LOADER,
        message: `Error loading "${relativeId(id)}": plugin load hook should return a string, a { code, map } object, or nothing/null.`
    };
}
function logCannotCallNamespace(name) {
    return {
        code: CANNOT_CALL_NAMESPACE,
        message: `Cannot call a namespace ("${name}").`
    };
}
function logCannotEmitFromOptionsHook() {
    return {
        code: CANNOT_EMIT_FROM_OPTIONS_HOOK,
        message: `Cannot emit files or set asset sources in the "outputOptions" hook, use the "renderStart" hook instead.`
    };
}
function logChunkNotGeneratedForFileName(name) {
    return {
        code: CHUNK_NOT_GENERATED,
        message: `Plugin error - Unable to get file name for emitted chunk "${name}". You can only get file names once chunks have been generated after the "renderStart" hook.`
    };
}
function logChunkInvalid({ fileName, code }, { pos, message }) {
    const errorProperties = {
        code: CHUNK_INVALID,
        message: `Chunk "${fileName}" is not valid JavaScript: ${message}.`
    };
    augmentCodeLocation(errorProperties, pos, code, fileName);
    return errorProperties;
}
function logCircularDependency(cyclePath) {
    return {
        code: CIRCULAR_DEPENDENCY,
        ids: cyclePath,
        message: `Circular dependency: ${cyclePath.map(relativeId).join(' -> ')}`
    };
}
function logCircularReexport(exportName, exporter) {
    return {
        code: CIRCULAR_REEXPORT,
        exporter,
        message: `"${exportName}" cannot be exported from "${relativeId(exporter)}" as it is a reexport that references itself.`
    };
}
function logCyclicCrossChunkReexport(exportName, exporter, reexporter, importer, preserveModules) {
    return {
        code: CYCLIC_CROSS_CHUNK_REEXPORT,
        exporter,
        id: importer,
        message: `Export "${exportName}" of module "${relativeId(exporter)}" was reexported through module "${relativeId(reexporter)}" while both modules are dependencies of each other and will end up in different chunks by current Rollup settings. This scenario is not well supported at the moment as it will produce a circular dependency between chunks and will likely lead to broken execution order.\nEither change the import in "${relativeId(importer)}" to point directly to the exporting module or ${preserveModules ? 'do not use "output.preserveModules"' : 'reconfigure "output.manualChunks"'} to ensure these modules end up in the same chunk.`,
        reexporter
    };
}
function logDeprecation(deprecation, urlSnippet, plugin) {
    return {
        code: DEPRECATED_FEATURE,
        message: deprecation,
        url: getRollupUrl(urlSnippet),
        ...({})
    };
}
function logConstVariableReassignError() {
    return {
        code: CONST_REASSIGN,
        message: 'Cannot reassign a variable declared with `const`'
    };
}
function logDuplicateArgumentNameError(name) {
    return {
        code: DUPLICATE_ARGUMENT_NAME,
        message: `Duplicate argument name "${name}"`
    };
}
function logDuplicateExportError(name) {
    return { code: DUPLICATE_EXPORT, message: `Duplicate export "${name}"` };
}
function logDuplicateImportOptions() {
    return {
        code: DUPLICATE_IMPORT_OPTIONS,
        message: 'Either use --input, or pass input path as argument'
    };
}
function logDuplicatePluginName(plugin) {
    return {
        code: DUPLICATE_PLUGIN_NAME,
        message: `The plugin name ${plugin} is being used twice in the same build. Plugin names must be distinct or provide a cacheKey (please post an issue to the plugin if you are a plugin user).`
    };
}
function logEmptyChunk(chunkName) {
    return {
        code: EMPTY_BUNDLE,
        message: `Generated an empty chunk: "${chunkName}".`,
        names: [chunkName]
    };
}
function logEval(id) {
    return {
        code: EVAL,
        id,
        message: `Use of eval in "${relativeId(id)}" is strongly discouraged as it poses security risks and may cause issues with minification.`,
        url: getRollupUrl(URL_AVOIDING_EVAL)
    };
}
function logExternalSyntheticExports(id, importer) {
    return {
        code: EXTERNAL_SYNTHETIC_EXPORTS,
        exporter: id,
        message: `External "${id}" cannot have "syntheticNamedExports" enabled (imported by "${relativeId(importer)}").`
    };
}
function logFailAfterWarnings() {
    return {
        code: FAIL_AFTER_WARNINGS,
        message: 'Warnings occurred and --failAfterWarnings flag present.'
    };
}
function logFileNameConflict(fileName) {
    return {
        code: FILE_NAME_CONFLICT,
        message: `The emitted file "${fileName}" overwrites a previously emitted file of the same name.`
    };
}
function logFileReferenceIdNotFoundForFilename(assetReferenceId) {
    return {
        code: FILE_NOT_FOUND,
        message: `Plugin error - Unable to get file name for unknown file "${assetReferenceId}".`
    };
}
function logFirstSideEffect(source, id, { line, column }) {
    return {
        code: FIRST_SIDE_EFFECT,
        message: `First side effect in ${relativeId(id)} is at (${line}:${column})\n${getCodeFrame(source, line, column)}`
    };
}
function logIllegalIdentifierAsName(name) {
    return {
        code: ILLEGAL_IDENTIFIER_AS_NAME,
        message: `Given name "${name}" is not a legal JS identifier. If you need this, you can try "output.extend: true".`,
        url: getRollupUrl(URL_OUTPUT_EXTEND)
    };
}
function logIllegalImportReassignment(name, importingId) {
    return {
        code: ILLEGAL_REASSIGNMENT,
        message: `Illegal reassignment of import "${name}" in "${relativeId(importingId)}".`
    };
}
function logInconsistentImportAttributes(existingAttributes, newAttributes, source, importer) {
    return {
        code: INCONSISTENT_IMPORT_ATTRIBUTES,
        message: `Module "${relativeId(importer)}" tried to import "${relativeId(source)}" with ${formatAttributes(newAttributes)} attributes, but it was already imported elsewhere with ${formatAttributes(existingAttributes)} attributes. Please ensure that import attributes for the same module are always consistent.`
    };
}
const formatAttributes = (attributes) => {
    const entries = Object.entries(attributes);
    if (entries.length === 0)
        return 'no';
    return entries.map(([key, value]) => `"${key}": "${value}"`).join(', ');
};
function logInvalidAnnotation(comment, id, type) {
    return {
        code: INVALID_ANNOTATION,
        id,
        message: `A comment\n\n"${comment}"\n\nin "${relativeId(id)}" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.`,
        url: getRollupUrl(type === 'noSideEffects' ? URL_TREESHAKE_NOSIDEEFFECTS : URL_TREESHAKE_PURE)
    };
}
function logInputHookInOutputPlugin(pluginName, hookName) {
    return {
        code: INPUT_HOOK_IN_OUTPUT_PLUGIN,
        message: `The "${hookName}" hook used by the output plugin ${pluginName} is a build time hook and will not be run for that plugin. Either this plugin cannot be used as an output plugin, or it should have an option to configure it as an output plugin.`
    };
}
function logCannotAssignModuleToChunk(moduleId, assignToAlias, currentAlias) {
    return {
        code: INVALID_CHUNK,
        message: `Cannot assign "${relativeId(moduleId)}" to the "${assignToAlias}" chunk as it is already in the "${currentAlias}" chunk.`
    };
}
function logCannotBundleConfigAsEsm(originalError) {
    return {
        cause: originalError,
        code: INVALID_CONFIG_MODULE_FORMAT,
        message: `Rollup transpiled your configuration to an  ES module even though it appears to contain CommonJS elements. To resolve this, you can pass the "--bundleConfigAsCjs" flag to Rollup or change your configuration to only contain valid ESM code.\n\nOriginal error: ${originalError.message}`,
        stack: originalError.stack,
        url: getRollupUrl(URL_BUNDLE_CONFIG_AS_CJS)
    };
}
function logCannotLoadConfigAsCjs(originalError) {
    return {
        cause: originalError,
        code: INVALID_CONFIG_MODULE_FORMAT,
        message: `Node tried to load your configuration file as CommonJS even though it is likely an ES module. To resolve this, change the extension of your configuration to ".mjs", set "type": "module" in your package.json file or pass the "--bundleConfigAsCjs" flag.\n\nOriginal error: ${originalError.message}`,
        stack: originalError.stack,
        url: getRollupUrl(URL_BUNDLE_CONFIG_AS_CJS)
    };
}
function logCannotLoadConfigAsEsm(originalError) {
    return {
        cause: originalError,
        code: INVALID_CONFIG_MODULE_FORMAT,
        message: `Node tried to load your configuration as an ES module even though it is likely CommonJS. To resolve this, change the extension of your configuration to ".cjs" or pass the "--bundleConfigAsCjs" flag.\n\nOriginal error: ${originalError.message}`,
        stack: originalError.stack,
        url: getRollupUrl(URL_BUNDLE_CONFIG_AS_CJS)
    };
}
function logInvalidExportOptionValue(optionValue) {
    return {
        code: INVALID_EXPORT_OPTION,
        message: `"output.exports" must be "default", "named", "none", "auto", or left unspecified (defaults to "auto"), received "${optionValue}".`,
        url: getRollupUrl(URL_OUTPUT_EXPORTS)
    };
}
function logIncompatibleExportOptionValue(optionValue, keys, entryModule) {
    return {
        code: INVALID_EXPORT_OPTION,
        message: `"${optionValue}" was specified for "output.exports", but entry module "${relativeId(entryModule)}" has the following exports: ${printQuotedStringList(keys)}`,
        url: getRollupUrl(URL_OUTPUT_EXPORTS)
    };
}
function logInternalIdCannotBeExternal(source, importer) {
    return {
        code: INVALID_EXTERNAL_ID,
        message: `"${source}" is imported as an external by "${relativeId(importer)}", but is already an existing non-external module id.`
    };
}
function logImportOptionsAreInvalid(importer) {
    return {
        code: INVALID_IMPORT_ATTRIBUTE,
        message: `Rollup could not statically analyze the options argument of a dynamic import in "${relativeId(importer)}". Dynamic import options need to be an object with a nested attributes object.`
    };
}
function logImportAttributeIsInvalid(importer) {
    return {
        code: INVALID_IMPORT_ATTRIBUTE,
        message: `Rollup could not statically analyze an import attribute of a dynamic import in "${relativeId(importer)}". Import attributes need to have string keys and values. The attribute will be removed.`
    };
}
function logInvalidLogPosition(plugin) {
    return {
        code: INVALID_LOG_POSITION,
        message: `Plugin "${plugin}" tried to add a file position to a log or warning. This is only supported in the "transform" hook at the moment and will be ignored.`
    };
}
function logInvalidOption(option, urlSnippet, explanation, value) {
    return {
        code: INVALID_OPTION,
        message: `Invalid value ${value === undefined ? '' : `${JSON.stringify(value)} `}for option "${option}" - ${explanation}.`,
        url: getRollupUrl(urlSnippet)
    };
}
function logInvalidAddonPluginHook(hook, plugin) {
    return {
        code: INVALID_PLUGIN_HOOK,
        hook,
        message: `Error running plugin hook "${hook}" for plugin "${plugin}", expected a string, a function hook or an object with a "handler" string or function.`,
        plugin
    };
}
function logInvalidFunctionPluginHook(hook, plugin) {
    return {
        code: INVALID_PLUGIN_HOOK,
        hook,
        message: `Error running plugin hook "${hook}" for plugin "${plugin}", expected a function hook or an object with a "handler" function.`,
        plugin
    };
}
function logInvalidRollupPhaseForChunkEmission() {
    return {
        code: INVALID_ROLLUP_PHASE,
        message: `Cannot emit chunks after module loading has finished.`
    };
}
function logInvalidSetAssetSourceCall() {
    return {
        code: INVALID_SETASSETSOURCE,
        message: `setAssetSource cannot be called in transform for caching reasons. Use emitFile with a source, or call setAssetSource in another hook.`
    };
}
function logInvalidFormatForTopLevelAwait(id, format) {
    return {
        code: INVALID_TLA_FORMAT,
        id,
        message: `Module format "${format}" does not support top-level await. Use the "es" or "system" output formats rather.`
    };
}
function logMissingConfig() {
    return {
        code: MISSING_CONFIG,
        message: 'Config file must export an options object, or an array of options objects',
        url: getRollupUrl(URL_CONFIGURATION_FILES)
    };
}
function logMissingEntryExport(binding, exporter) {
    return {
        binding,
        code: MISSING_EXPORT,
        exporter,
        message: `Exported variable "${binding}" is not defined in "${relativeId(exporter)}".`,
        url: getRollupUrl(URL_NAME_IS_NOT_EXPORTED)
    };
}
function logMissingExport(binding, importingModule, exporter) {
    const isJson = path.extname(exporter) === '.json';
    return {
        binding,
        code: MISSING_EXPORT,
        exporter,
        id: importingModule,
        message: `"${binding}" is not exported by "${relativeId(exporter)}", imported by "${relativeId(importingModule)}".${isJson ? ' (Note that you need @rollup/plugin-json to import JSON files)' : ''}`,
        url: getRollupUrl(URL_NAME_IS_NOT_EXPORTED)
    };
}
function logMissingExternalConfig(file) {
    return {
        code: MISSING_EXTERNAL_CONFIG,
        message: `Could not resolve config file "${file}"`
    };
}
function logMissingGlobalName(externalId, guess) {
    return {
        code: MISSING_GLOBAL_NAME,
        id: externalId,
        message: `No name was provided for external module "${externalId}" in "output.globals" – guessing "${guess}".`,
        names: [guess],
        url: getRollupUrl(URL_OUTPUT_GLOBALS)
    };
}
function logImplicitDependantCannotBeExternal(unresolvedId, implicitlyLoadedBefore) {
    return {
        code: MISSING_IMPLICIT_DEPENDANT,
        message: `Module "${relativeId(unresolvedId)}" that should be implicitly loaded before "${relativeId(implicitlyLoadedBefore)}" cannot be external.`
    };
}
function logUnresolvedImplicitDependant(unresolvedId, implicitlyLoadedBefore) {
    return {
        code: MISSING_IMPLICIT_DEPENDANT,
        message: `Module "${relativeId(unresolvedId)}" that should be implicitly loaded before "${relativeId(implicitlyLoadedBefore)}" could not be resolved.`
    };
}
function logImplicitDependantIsNotIncluded(module) {
    const implicitDependencies = [...module.implicitlyLoadedBefore]
        .map(dependency => relativeId(dependency.id))
        .sort();
    return {
        code: MISSING_IMPLICIT_DEPENDANT,
        message: `Module "${relativeId(module.id)}" that should be implicitly loaded before ${printQuotedStringList(implicitDependencies)} is not included in the module graph. Either it was not imported by an included module or only via a tree-shaken dynamic import, or no imported bindings were used and it had otherwise no side-effects.`
    };
}
function logMissingNameOptionForIifeExport() {
    return {
        code: MISSING_NAME_OPTION_FOR_IIFE_EXPORT,
        message: `If you do not supply "output.name", you may not be able to access the exports of an IIFE bundle.`,
        url: getRollupUrl(URL_OUTPUT_NAME)
    };
}
function logMissingNameOptionForUmdExport() {
    return {
        code: MISSING_NAME_OPTION_FOR_IIFE_EXPORT,
        message: 'You must supply "output.name" for UMD bundles that have exports so that the exports are accessible in environments without a module loader.',
        url: getRollupUrl(URL_OUTPUT_NAME)
    };
}
function logMissingNodeBuiltins(externalBuiltins) {
    return {
        code: MISSING_NODE_BUILTINS,
        ids: externalBuiltins,
        message: `Creating a browser bundle that depends on Node.js built-in modules (${printQuotedStringList(externalBuiltins)}). You might need to include https://github.com/FredKSchott/rollup-plugin-polyfill-node`
    };
}
// eslint-disable-next-line unicorn/prevent-abbreviations
function logMissingFileOrDirOption() {
    return {
        code: MISSING_OPTION,
        message: 'You must specify "output.file" or "output.dir" for the build.',
        url: getRollupUrl(URL_OUTPUT_DIR)
    };
}
function logMixedExport(facadeModuleId, name) {
    return {
        code: MIXED_EXPORTS,
        id: facadeModuleId,
        message: `Entry module "${relativeId(facadeModuleId)}" is using named and default exports together. Consumers of your bundle will have to use \`${name || 'chunk'}.default\` to access the default export, which may not be what you want. Use \`output.exports: "named"\` to disable this warning.`,
        url: getRollupUrl(URL_OUTPUT_EXPORTS)
    };
}
function logModuleLevelDirective(directive, id) {
    return {
        code: MODULE_LEVEL_DIRECTIVE,
        id,
        message: `Module level directives cause errors when bundled, "${directive}" in "${relativeId(id)}" was ignored.`
    };
}
function logNamespaceConflict(binding, reexportingModuleId, sources) {
    return {
        binding,
        code: NAMESPACE_CONFLICT,
        ids: sources,
        message: `Conflicting namespaces: "${relativeId(reexportingModuleId)}" re-exports "${binding}" from one of the modules ${printQuotedStringList(sources.map(moduleId => relativeId(moduleId)))} (will be ignored).`,
        reexporter: reexportingModuleId
    };
}
function logNoTransformMapOrAstWithoutCode(pluginName) {
    return {
        code: NO_TRANSFORM_MAP_OR_AST_WITHOUT_CODE,
        message: `The plugin "${pluginName}" returned a "map" or "ast" without returning ` +
            'a "code". This will be ignored.'
    };
}
function logOnlyInlineSourcemapsForStdout() {
    return {
        code: ONLY_INLINE_SOURCEMAPS,
        message: 'Only inline sourcemaps are supported when bundling to stdout.'
    };
}
function logOptimizeChunkStatus(chunks, smallChunks, pointInTime) {
    return {
        code: OPTIMIZE_CHUNK_STATUS,
        message: `${pointInTime}, there are\n` +
            `${chunks} chunks, of which\n` +
            `${smallChunks} are below minChunkSize.`
    };
}
function logParseError(message, pos) {
    return { code: PARSE_ERROR, message, pos };
}
function logRedeclarationError(name) {
    return {
        code: REDECLARATION_ERROR,
        message: `Identifier "${name}" has already been declared`
    };
}
function logModuleParseError(error, moduleId) {
    let message = error.message.replace(/ \(\d+:\d+\)$/, '');
    if (moduleId.endsWith('.json')) {
        message += ' (Note that you need @rollup/plugin-json to import JSON files)';
    }
    else if (!moduleId.endsWith('.js')) {
        message += ' (Note that you need plugins to import files that are not JavaScript)';
    }
    return {
        cause: error,
        code: PARSE_ERROR,
        id: moduleId,
        message,
        stack: error.stack
    };
}
function logPluginError(error, plugin, { hook, id } = {}) {
    const code = error.code;
    if (!error.pluginCode &&
        code != null &&
        (typeof code !== 'string' || !code.startsWith('PLUGIN_'))) {
        error.pluginCode = code;
    }
    error.code = PLUGIN_ERROR;
    error.plugin = plugin;
    if (hook) {
        error.hook = hook;
    }
    if (id) {
        error.id = id;
    }
    return error;
}
function logShimmedExport(id, binding) {
    return {
        binding,
        code: SHIMMED_EXPORT,
        exporter: id,
        message: `Missing export "${binding}" has been shimmed in module "${relativeId(id)}".`
    };
}
function logSourcemapBroken(plugin) {
    return {
        code: SOURCEMAP_BROKEN,
        message: `Sourcemap is likely to be incorrect: a plugin (${plugin}) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help`,
        plugin,
        url: getRollupUrl(URL_SOURCEMAP_IS_LIKELY_TO_BE_INCORRECT)
    };
}
function logConflictingSourcemapSources(filename) {
    return {
        code: SOURCEMAP_BROKEN,
        message: `Multiple conflicting contents for sourcemap source ${filename}`
    };
}
function logInvalidSourcemapForError(error, id, column, line, pos) {
    return {
        cause: error,
        code: SOURCEMAP_ERROR,
        id,
        loc: {
            column,
            file: id,
            line
        },
        message: `Error when using sourcemap for reporting an error: ${error.message}`,
        pos
    };
}
function logSyntheticNamedExportsNeedNamespaceExport(id, syntheticNamedExportsOption) {
    return {
        code: SYNTHETIC_NAMED_EXPORTS_NEED_NAMESPACE_EXPORT,
        exporter: id,
        message: `Module "${relativeId(id)}" that is marked with \`syntheticNamedExports: ${JSON.stringify(syntheticNamedExportsOption)}\` needs ${typeof syntheticNamedExportsOption === 'string' && syntheticNamedExportsOption !== 'default'
            ? `an explicit export named "${syntheticNamedExportsOption}"`
            : 'a default export'} that does not reexport an unresolved named export of the same module.`
    };
}
function logThisIsUndefined() {
    return {
        code: THIS_IS_UNDEFINED,
        message: `The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten`,
        url: getRollupUrl(URL_THIS_IS_UNDEFINED)
    };
}
function logUnexpectedNamedImport(id, imported, isReexport) {
    const importType = isReexport ? 'reexport' : 'import';
    return {
        code: UNEXPECTED_NAMED_IMPORT,
        exporter: id,
        message: `The named export "${imported}" was ${importType}ed from the external module "${relativeId(id)}" even though its interop type is "defaultOnly". Either remove or change this ${importType} or change the value of the "output.interop" option.`,
        url: getRollupUrl(URL_OUTPUT_INTEROP)
    };
}
function logUnexpectedNamespaceReexport(id) {
    return {
        code: UNEXPECTED_NAMED_IMPORT,
        exporter: id,
        message: `There was a namespace "*" reexport from the external module "${relativeId(id)}" even though its interop type is "defaultOnly". This will be ignored as namespace reexports only reexport named exports. If this is not intended, either remove or change this reexport or change the value of the "output.interop" option.`,
        url: getRollupUrl(URL_OUTPUT_INTEROP)
    };
}
function logUnknownOption(optionType, unknownOptions, validOptions) {
    return {
        code: UNKNOWN_OPTION,
        message: `Unknown ${optionType}: ${unknownOptions.join(', ')}. Allowed options: ${validOptions.join(', ')}`
    };
}
function logEntryCannotBeExternal(unresolvedId) {
    return {
        code: UNRESOLVED_ENTRY,
        message: `Entry module "${relativeId(unresolvedId)}" cannot be external.`
    };
}
function logExternalModulesCannotBeIncludedInManualChunks(source) {
    return {
        code: EXTERNAL_MODULES_CANNOT_BE_INCLUDED_IN_MANUAL_CHUNKS,
        message: `"${source}" cannot be included in manualChunks because it is resolved as an external module by the "external" option or plugins.`
    };
}
function logExternalModulesCannotBeTransformedToModules(source) {
    return {
        code: EXTERNAL_MODULES_CANNOT_BE_TRANSFORMED_TO_MODULES,
        message: `${source} is resolved as a module now, but it was an external module before. Please check whether there are conflicts in your Rollup options "external" and "manualChunks", manualChunks cannot include external modules.`
    };
}
function logUnresolvedEntry(unresolvedId) {
    return {
        code: UNRESOLVED_ENTRY,
        message: `Could not resolve entry module "${relativeId(unresolvedId)}".`
    };
}
function logUnresolvedImport(source, importer) {
    return {
        code: UNRESOLVED_IMPORT,
        exporter: source,
        id: importer,
        message: `Could not resolve "${source}" from "${relativeId(importer)}"`
    };
}
function logUnresolvedImportTreatedAsExternal(source, importer) {
    return {
        code: UNRESOLVED_IMPORT,
        exporter: source,
        id: importer,
        message: `"${source}" is imported by "${relativeId(importer)}", but could not be resolved – treating it as an external dependency.`,
        url: getRollupUrl(URL_TREATING_MODULE_AS_EXTERNAL_DEPENDENCY)
    };
}
function logUnusedExternalImports(externalId, names, importers) {
    return {
        code: UNUSED_EXTERNAL_IMPORT,
        exporter: externalId,
        ids: importers,
        message: `${printQuotedStringList(names, [
            'is',
            'are'
        ])} imported from external module "${externalId}" but never used in ${printQuotedStringList(importers.map(importer => relativeId(importer)))}.`,
        names
    };
}
function logFailedValidation(message) {
    return {
        code: VALIDATION_ERROR,
        message
    };
}
function warnDeprecation(deprecation, urlSnippet, activeDeprecation, options, plugin) {
    warnDeprecationWithOptions(deprecation, urlSnippet, activeDeprecation, options.onLog, options.strictDeprecations);
}
function warnDeprecationWithOptions(deprecation, urlSnippet, activeDeprecation, log, strictDeprecations, plugin) {
    {
        const warning = logDeprecation(deprecation, urlSnippet);
        if (strictDeprecations) {
            return error(warning);
        }
        log(LOGLEVEL_WARN, warning);
    }
}

const BLANK = Object.freeze(Object.create(null));
const EMPTY_OBJECT = Object.freeze({});
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_SET = Object.freeze(new (class extends Set {
    add() {
        throw new Error('Cannot add to empty set');
    }
})());

// This file is generated by scripts/generate-node-types.js.
// Do not edit this file directly.
const ArrowFunctionExpression = 'ArrowFunctionExpression';
const BlockStatement = 'BlockStatement';
const CallExpression = 'CallExpression';
const CatchClause = 'CatchClause';
const ExportDefaultDeclaration = 'ExportDefaultDeclaration';
const ExpressionStatement = 'ExpressionStatement';
const Identifier = 'Identifier';
const Literal = 'Literal';
const PanicError = 'PanicError';
const ParseError = 'ParseError';
const Program = 'Program';
const Property = 'Property';
const ReturnStatement = 'ReturnStatement';
const TemplateLiteral = 'TemplateLiteral';
const VariableDeclarator = 'VariableDeclarator';

// This file is generated by scripts/generate-string-constants.js.
// Do not edit this file directly.
const FIXED_STRINGS = [
    'var',
    'let',
    'const',
    'init',
    'get',
    'set',
    'constructor',
    'method',
    '-',
    '+',
    '!',
    '~',
    'typeof',
    'void',
    'delete',
    '++',
    '--',
    '==',
    '!=',
    '===',
    '!==',
    '<',
    '<=',
    '>',
    '>=',
    '<<',
    '>>',
    '>>>',
    '+',
    '-',
    '*',
    '/',
    '%',
    '|',
    '^',
    '&',
    '||',
    '&&',
    'in',
    'instanceof',
    '**',
    '??',
    '=',
    '+=',
    '-=',
    '*=',
    '/=',
    '%=',
    '<<=',
    '>>=',
    '>>>=',
    '|=',
    '^=',
    '&=',
    '**=',
    '&&=',
    '||=',
    '??=',
    'pure',
    'noSideEffects',
    'sourcemap',
    'using',
    'await using'
];

const ANNOTATION_KEY = '_rollupAnnotations';
const INVALID_ANNOTATION_KEY = '_rollupRemoved';
const convertAnnotations = (position, buffer) => {
    if (position === 0)
        return EMPTY_ARRAY;
    const length = buffer[position++];
    const list = [];
    for (let index = 0; index < length; index++) {
        list.push(convertAnnotation(buffer[position++], buffer));
    }
    return list;
};
const convertAnnotation = (position, buffer) => {
    const start = buffer[position++];
    const end = buffer[position++];
    const type = FIXED_STRINGS[buffer[position]];
    return { end, start, type };
};
const convertString = (position, buffer, readString) => {
    const length = buffer[position++];
    const bytePosition = position << 2;
    return readString(bytePosition, length);
};

// This file is generated by scripts/generate-buffer-to-ast.js.
// Do not edit this file directly.
function convertProgram(buffer, readString) {
    const node = convertNode(0, new Uint32Array(buffer), readString);
    switch (node.type) {
        case PanicError: {
            return error(getRollupError(logParseError(node.message)));
        }
        case ParseError: {
            return error(getRollupError(logParseError(node.message, node.start)));
        }
        default: {
            return node;
        }
    }
}
/* eslint-disable sort-keys */
const nodeConverters = [
    function panicError(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const message = convertString(buffer[position], buffer, readString);
        return {
            type: 'PanicError',
            start,
            end,
            message
        };
    },
    function parseError(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const message = convertString(buffer[position], buffer, readString);
        return {
            type: 'ParseError',
            start,
            end,
            message
        };
    },
    function arrayExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const elements = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'ArrayExpression',
            start,
            end,
            elements
        };
    },
    function arrayPattern(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const elements = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'ArrayPattern',
            start,
            end,
            elements
        };
    },
    function arrowFunctionExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const async = (flags & 1) === 1;
        const expression = (flags & 2) === 2;
        const generator = (flags & 4) === 4;
        const annotations = convertAnnotations(buffer[position++], buffer);
        const parameters = convertNodeList(buffer[position++], buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ArrowFunctionExpression',
            start,
            end,
            async,
            expression,
            generator,
            ...(annotations.length > 0 ? { [ANNOTATION_KEY]: annotations } : {}),
            params: parameters,
            body,
            id: null
        };
    },
    function assignmentExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const operator = FIXED_STRINGS[buffer[position++]];
        const left = convertNode(buffer[position++], buffer, readString);
        const right = convertNode(buffer[position], buffer, readString);
        return {
            type: 'AssignmentExpression',
            start,
            end,
            operator,
            left,
            right
        };
    },
    function assignmentPattern(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const left = convertNode(buffer[position++], buffer, readString);
        const right = convertNode(buffer[position], buffer, readString);
        return {
            type: 'AssignmentPattern',
            start,
            end,
            left,
            right
        };
    },
    function awaitExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const argument = convertNode(buffer[position], buffer, readString);
        return {
            type: 'AwaitExpression',
            start,
            end,
            argument
        };
    },
    function binaryExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const operator = FIXED_STRINGS[buffer[position++]];
        const left = convertNode(buffer[position++], buffer, readString);
        const right = convertNode(buffer[position], buffer, readString);
        return {
            type: 'BinaryExpression',
            start,
            end,
            operator,
            left,
            right
        };
    },
    function blockStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const body = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'BlockStatement',
            start,
            end,
            body
        };
    },
    function breakStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const labelPosition = buffer[position];
        const label = labelPosition === 0 ? null : convertNode(labelPosition, buffer, readString);
        return {
            type: 'BreakStatement',
            start,
            end,
            label
        };
    },
    function callExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const optional = (flags & 1) === 1;
        const annotations = convertAnnotations(buffer[position++], buffer);
        const callee = convertNode(buffer[position++], buffer, readString);
        const callArguments = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'CallExpression',
            start,
            end,
            optional,
            ...(annotations.length > 0 ? { [ANNOTATION_KEY]: annotations } : {}),
            callee,
            arguments: callArguments
        };
    },
    function catchClause(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const parameterPosition = buffer[position++];
        const parameter = parameterPosition === 0 ? null : convertNode(parameterPosition, buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'CatchClause',
            start,
            end,
            param: parameter,
            body
        };
    },
    function chainExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const expression = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ChainExpression',
            start,
            end,
            expression
        };
    },
    function classBody(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const body = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'ClassBody',
            start,
            end,
            body
        };
    },
    function classDeclaration(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const idPosition = buffer[position++];
        const id = idPosition === 0 ? null : convertNode(idPosition, buffer, readString);
        const superClassPosition = buffer[position++];
        const superClass = superClassPosition === 0 ? null : convertNode(superClassPosition, buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ClassDeclaration',
            start,
            end,
            id,
            superClass,
            body
        };
    },
    function classExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const idPosition = buffer[position++];
        const id = idPosition === 0 ? null : convertNode(idPosition, buffer, readString);
        const superClassPosition = buffer[position++];
        const superClass = superClassPosition === 0 ? null : convertNode(superClassPosition, buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ClassExpression',
            start,
            end,
            id,
            superClass,
            body
        };
    },
    function conditionalExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const test = convertNode(buffer[position++], buffer, readString);
        const consequent = convertNode(buffer[position++], buffer, readString);
        const alternate = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ConditionalExpression',
            start,
            end,
            test,
            consequent,
            alternate
        };
    },
    function continueStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const labelPosition = buffer[position];
        const label = labelPosition === 0 ? null : convertNode(labelPosition, buffer, readString);
        return {
            type: 'ContinueStatement',
            start,
            end,
            label
        };
    },
    function debuggerStatement(position, buffer) {
        const start = buffer[position++];
        const end = buffer[position++];
        return {
            type: 'DebuggerStatement',
            start,
            end
        };
    },
    function directive(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const directive = convertString(buffer[position++], buffer, readString);
        const expression = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ExpressionStatement',
            start,
            end,
            directive,
            expression
        };
    },
    function doWhileStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const body = convertNode(buffer[position++], buffer, readString);
        const test = convertNode(buffer[position], buffer, readString);
        return {
            type: 'DoWhileStatement',
            start,
            end,
            body,
            test
        };
    },
    function emptyStatement(position, buffer) {
        const start = buffer[position++];
        const end = buffer[position++];
        return {
            type: 'EmptyStatement',
            start,
            end
        };
    },
    function exportAllDeclaration(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const exportedPosition = buffer[position++];
        const exported = exportedPosition === 0 ? null : convertNode(exportedPosition, buffer, readString);
        const source = convertNode(buffer[position++], buffer, readString);
        const attributes = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'ExportAllDeclaration',
            start,
            end,
            exported,
            source,
            attributes
        };
    },
    function exportDefaultDeclaration(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const declaration = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ExportDefaultDeclaration',
            start,
            end,
            declaration
        };
    },
    function exportNamedDeclaration(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const specifiers = convertNodeList(buffer[position++], buffer, readString);
        const sourcePosition = buffer[position++];
        const source = sourcePosition === 0 ? null : convertNode(sourcePosition, buffer, readString);
        const attributes = convertNodeList(buffer[position++], buffer, readString);
        const declarationPosition = buffer[position];
        const declaration = declarationPosition === 0 ? null : convertNode(declarationPosition, buffer, readString);
        return {
            type: 'ExportNamedDeclaration',
            start,
            end,
            specifiers,
            source,
            attributes,
            declaration
        };
    },
    function exportSpecifier(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const local = convertNode(buffer[position++], buffer, readString);
        const exportedPosition = buffer[position];
        return {
            type: 'ExportSpecifier',
            start,
            end,
            local,
            exported: exportedPosition === 0 ? { ...local } : convertNode(exportedPosition, buffer, readString)
        };
    },
    function expressionStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const expression = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ExpressionStatement',
            start,
            end,
            expression
        };
    },
    function forInStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const left = convertNode(buffer[position++], buffer, readString);
        const right = convertNode(buffer[position++], buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ForInStatement',
            start,
            end,
            left,
            right,
            body
        };
    },
    function forOfStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const awaited = (flags & 1) === 1;
        const left = convertNode(buffer[position++], buffer, readString);
        const right = convertNode(buffer[position++], buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ForOfStatement',
            start,
            end,
            await: awaited,
            left,
            right,
            body
        };
    },
    function forStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const initPosition = buffer[position++];
        const init = initPosition === 0 ? null : convertNode(initPosition, buffer, readString);
        const testPosition = buffer[position++];
        const test = testPosition === 0 ? null : convertNode(testPosition, buffer, readString);
        const updatePosition = buffer[position++];
        const update = updatePosition === 0 ? null : convertNode(updatePosition, buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ForStatement',
            start,
            end,
            init,
            test,
            update,
            body
        };
    },
    function functionDeclaration(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const async = (flags & 1) === 1;
        const generator = (flags & 2) === 2;
        const annotations = convertAnnotations(buffer[position++], buffer);
        const idPosition = buffer[position++];
        const id = idPosition === 0 ? null : convertNode(idPosition, buffer, readString);
        const parameters = convertNodeList(buffer[position++], buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'FunctionDeclaration',
            start,
            end,
            async,
            generator,
            ...(annotations.length > 0 ? { [ANNOTATION_KEY]: annotations } : {}),
            id,
            params: parameters,
            body,
            expression: false
        };
    },
    function functionExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const async = (flags & 1) === 1;
        const generator = (flags & 2) === 2;
        const annotations = convertAnnotations(buffer[position++], buffer);
        const idPosition = buffer[position++];
        const id = idPosition === 0 ? null : convertNode(idPosition, buffer, readString);
        const parameters = convertNodeList(buffer[position++], buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'FunctionExpression',
            start,
            end,
            async,
            generator,
            ...(annotations.length > 0 ? { [ANNOTATION_KEY]: annotations } : {}),
            id,
            params: parameters,
            body,
            expression: false
        };
    },
    function identifier(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const name = convertString(buffer[position], buffer, readString);
        return {
            type: 'Identifier',
            start,
            end,
            name
        };
    },
    function ifStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const test = convertNode(buffer[position++], buffer, readString);
        const consequent = convertNode(buffer[position++], buffer, readString);
        const alternatePosition = buffer[position];
        const alternate = alternatePosition === 0 ? null : convertNode(alternatePosition, buffer, readString);
        return {
            type: 'IfStatement',
            start,
            end,
            test,
            consequent,
            alternate
        };
    },
    function importAttribute(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const key = convertNode(buffer[position++], buffer, readString);
        const value = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ImportAttribute',
            start,
            end,
            key,
            value
        };
    },
    function importDeclaration(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const specifiers = convertNodeList(buffer[position++], buffer, readString);
        const source = convertNode(buffer[position++], buffer, readString);
        const attributes = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'ImportDeclaration',
            start,
            end,
            specifiers,
            source,
            attributes
        };
    },
    function importDefaultSpecifier(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const local = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ImportDefaultSpecifier',
            start,
            end,
            local
        };
    },
    function importExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const source = convertNode(buffer[position++], buffer, readString);
        const optionsPosition = buffer[position];
        const options = optionsPosition === 0 ? null : convertNode(optionsPosition, buffer, readString);
        return {
            type: 'ImportExpression',
            start,
            end,
            source,
            options
        };
    },
    function importNamespaceSpecifier(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const local = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ImportNamespaceSpecifier',
            start,
            end,
            local
        };
    },
    function importSpecifier(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const importedPosition = buffer[position++];
        const local = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ImportSpecifier',
            start,
            end,
            imported: importedPosition === 0 ? { ...local } : convertNode(importedPosition, buffer, readString),
            local
        };
    },
    function labeledStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const label = convertNode(buffer[position++], buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'LabeledStatement',
            start,
            end,
            label,
            body
        };
    },
    function literalBigInt(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const bigint = convertString(buffer[position++], buffer, readString);
        const raw = convertString(buffer[position], buffer, readString);
        return {
            type: 'Literal',
            start,
            end,
            bigint,
            raw,
            value: BigInt(bigint)
        };
    },
    function literalBoolean(position, buffer) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const value = (flags & 1) === 1;
        return {
            type: 'Literal',
            start,
            end,
            value,
            raw: value ? 'true' : 'false'
        };
    },
    function literalNull(position, buffer) {
        const start = buffer[position++];
        const end = buffer[position++];
        return {
            type: 'Literal',
            start,
            end,
            raw: 'null',
            value: null
        };
    },
    function literalNumber(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const rawPosition = buffer[position++];
        const raw = rawPosition === 0 ? undefined : convertString(rawPosition, buffer, readString);
        const value = new DataView(buffer.buffer).getFloat64(position << 2, true);
        return {
            type: 'Literal',
            start,
            end,
            raw,
            value
        };
    },
    function literalRegExp(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = convertString(buffer[position++], buffer, readString);
        const pattern = convertString(buffer[position], buffer, readString);
        return {
            type: 'Literal',
            start,
            end,
            raw: `/${pattern}/${flags}`,
            regex: { flags, pattern },
            value: new RegExp(pattern, flags)
        };
    },
    function literalString(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const value = convertString(buffer[position++], buffer, readString);
        const rawPosition = buffer[position];
        const raw = rawPosition === 0 ? undefined : convertString(rawPosition, buffer, readString);
        return {
            type: 'Literal',
            start,
            end,
            value,
            raw
        };
    },
    function logicalExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const operator = FIXED_STRINGS[buffer[position++]];
        const left = convertNode(buffer[position++], buffer, readString);
        const right = convertNode(buffer[position], buffer, readString);
        return {
            type: 'LogicalExpression',
            start,
            end,
            operator,
            left,
            right
        };
    },
    function memberExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const computed = (flags & 1) === 1;
        const optional = (flags & 2) === 2;
        const object = convertNode(buffer[position++], buffer, readString);
        const property = convertNode(buffer[position], buffer, readString);
        return {
            type: 'MemberExpression',
            start,
            end,
            computed,
            optional,
            object,
            property
        };
    },
    function metaProperty(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const meta = convertNode(buffer[position++], buffer, readString);
        const property = convertNode(buffer[position], buffer, readString);
        return {
            type: 'MetaProperty',
            start,
            end,
            meta,
            property
        };
    },
    function methodDefinition(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const isStatic = (flags & 1) === 1;
        const computed = (flags & 2) === 2;
        const key = convertNode(buffer[position++], buffer, readString);
        const value = convertNode(buffer[position++], buffer, readString);
        const kind = FIXED_STRINGS[buffer[position]];
        return {
            type: 'MethodDefinition',
            start,
            end,
            static: isStatic,
            computed,
            key,
            value,
            kind
        };
    },
    function newExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const annotations = convertAnnotations(buffer[position++], buffer);
        const callee = convertNode(buffer[position++], buffer, readString);
        const callArguments = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'NewExpression',
            start,
            end,
            ...(annotations.length > 0 ? { [ANNOTATION_KEY]: annotations } : {}),
            callee,
            arguments: callArguments
        };
    },
    function objectExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const properties = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'ObjectExpression',
            start,
            end,
            properties
        };
    },
    function objectPattern(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const properties = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'ObjectPattern',
            start,
            end,
            properties
        };
    },
    function privateIdentifier(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const name = convertString(buffer[position], buffer, readString);
        return {
            type: 'PrivateIdentifier',
            start,
            end,
            name
        };
    },
    function program(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const body = convertNodeList(buffer[position++], buffer, readString);
        const invalidAnnotations = convertAnnotations(buffer[position], buffer);
        return {
            type: 'Program',
            start,
            end,
            body,
            ...(invalidAnnotations.length > 0 ? { [INVALID_ANNOTATION_KEY]: invalidAnnotations } : {}),
            sourceType: 'module'
        };
    },
    function property(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const method = (flags & 1) === 1;
        const shorthand = (flags & 2) === 2;
        const computed = (flags & 4) === 4;
        const keyPosition = buffer[position++];
        const value = convertNode(buffer[position++], buffer, readString);
        const kind = FIXED_STRINGS[buffer[position]];
        return {
            type: 'Property',
            start,
            end,
            method,
            shorthand,
            computed,
            key: keyPosition === 0 ? { ...value } : convertNode(keyPosition, buffer, readString),
            value,
            kind
        };
    },
    function propertyDefinition(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const isStatic = (flags & 1) === 1;
        const computed = (flags & 2) === 2;
        const key = convertNode(buffer[position++], buffer, readString);
        const valuePosition = buffer[position];
        const value = valuePosition === 0 ? null : convertNode(valuePosition, buffer, readString);
        return {
            type: 'PropertyDefinition',
            start,
            end,
            static: isStatic,
            computed,
            key,
            value
        };
    },
    function restElement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const argument = convertNode(buffer[position], buffer, readString);
        return {
            type: 'RestElement',
            start,
            end,
            argument
        };
    },
    function returnStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const argumentPosition = buffer[position];
        const argument = argumentPosition === 0 ? null : convertNode(argumentPosition, buffer, readString);
        return {
            type: 'ReturnStatement',
            start,
            end,
            argument
        };
    },
    function sequenceExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const expressions = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'SequenceExpression',
            start,
            end,
            expressions
        };
    },
    function spreadElement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const argument = convertNode(buffer[position], buffer, readString);
        return {
            type: 'SpreadElement',
            start,
            end,
            argument
        };
    },
    function staticBlock(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const body = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'StaticBlock',
            start,
            end,
            body
        };
    },
    function superElement(position, buffer) {
        const start = buffer[position++];
        const end = buffer[position++];
        return {
            type: 'Super',
            start,
            end
        };
    },
    function switchCase(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const testPosition = buffer[position++];
        const test = testPosition === 0 ? null : convertNode(testPosition, buffer, readString);
        const consequent = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'SwitchCase',
            start,
            end,
            test,
            consequent
        };
    },
    function switchStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const discriminant = convertNode(buffer[position++], buffer, readString);
        const cases = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'SwitchStatement',
            start,
            end,
            discriminant,
            cases
        };
    },
    function taggedTemplateExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const tag = convertNode(buffer[position++], buffer, readString);
        const quasi = convertNode(buffer[position], buffer, readString);
        return {
            type: 'TaggedTemplateExpression',
            start,
            end,
            tag,
            quasi
        };
    },
    function templateElement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const tail = (flags & 1) === 1;
        const cookedPosition = buffer[position++];
        const cooked = cookedPosition === 0 ? undefined : convertString(cookedPosition, buffer, readString);
        const raw = convertString(buffer[position], buffer, readString);
        return {
            type: 'TemplateElement',
            start,
            end,
            tail,
            value: { cooked, raw }
        };
    },
    function templateLiteral(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const quasis = convertNodeList(buffer[position++], buffer, readString);
        const expressions = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'TemplateLiteral',
            start,
            end,
            quasis,
            expressions
        };
    },
    function thisExpression(position, buffer) {
        const start = buffer[position++];
        const end = buffer[position++];
        return {
            type: 'ThisExpression',
            start,
            end
        };
    },
    function throwStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const argument = convertNode(buffer[position], buffer, readString);
        return {
            type: 'ThrowStatement',
            start,
            end,
            argument
        };
    },
    function tryStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const block = convertNode(buffer[position++], buffer, readString);
        const handlerPosition = buffer[position++];
        const handler = handlerPosition === 0 ? null : convertNode(handlerPosition, buffer, readString);
        const finalizerPosition = buffer[position];
        const finalizer = finalizerPosition === 0 ? null : convertNode(finalizerPosition, buffer, readString);
        return {
            type: 'TryStatement',
            start,
            end,
            block,
            handler,
            finalizer
        };
    },
    function unaryExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const operator = FIXED_STRINGS[buffer[position++]];
        const argument = convertNode(buffer[position], buffer, readString);
        return {
            type: 'UnaryExpression',
            start,
            end,
            operator,
            argument,
            prefix: true
        };
    },
    function updateExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const prefix = (flags & 1) === 1;
        const operator = FIXED_STRINGS[buffer[position++]];
        const argument = convertNode(buffer[position], buffer, readString);
        return {
            type: 'UpdateExpression',
            start,
            end,
            prefix,
            operator,
            argument
        };
    },
    function variableDeclaration(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const kind = FIXED_STRINGS[buffer[position++]];
        const declarations = convertNodeList(buffer[position], buffer, readString);
        return {
            type: 'VariableDeclaration',
            start,
            end,
            kind,
            declarations
        };
    },
    function variableDeclarator(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const id = convertNode(buffer[position++], buffer, readString);
        const initPosition = buffer[position];
        const init = initPosition === 0 ? null : convertNode(initPosition, buffer, readString);
        return {
            type: 'VariableDeclarator',
            start,
            end,
            id,
            init
        };
    },
    function whileStatement(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const test = convertNode(buffer[position++], buffer, readString);
        const body = convertNode(buffer[position], buffer, readString);
        return {
            type: 'WhileStatement',
            start,
            end,
            test,
            body
        };
    },
    function yieldExpression(position, buffer, readString) {
        const start = buffer[position++];
        const end = buffer[position++];
        const flags = buffer[position++];
        const delegate = (flags & 1) === 1;
        const argumentPosition = buffer[position];
        const argument = argumentPosition === 0 ? null : convertNode(argumentPosition, buffer, readString);
        return {
            type: 'YieldExpression',
            start,
            end,
            delegate,
            argument
        };
    }
];
function convertNode(position, buffer, readString) {
    const nodeType = buffer[position];
    const converter = nodeConverters[nodeType];
    /* istanbul ignore if: This should never be executed but is a safeguard against faulty buffers */
    if (!converter) {
        console.trace();
        throw new Error(`Unknown node type: ${nodeType}`);
    }
    return converter(position + 1, buffer, readString);
}
function convertNodeList(position, buffer, readString) {
    if (position === 0)
        return EMPTY_ARRAY;
    const length = buffer[position++];
    const list = [];
    for (let index = 0; index < length; index++) {
        const nodePosition = buffer[position++];
        list.push(nodePosition ? convertNode(nodePosition, buffer, readString) : null);
    }
    return list;
}

function getReadStringFunction(astBuffer) {
    if (typeof Buffer !== 'undefined' && astBuffer instanceof Buffer) {
        return function readString(start, length) {
            return astBuffer.toString('utf8', start, start + length);
        };
    }
    else {
        const textDecoder = new TextDecoder();
        return function readString(start, length) {
            return textDecoder.decode(astBuffer.subarray(start, start + length));
        };
    }
}

const parseAst = (input, { allowReturnOutsideFunction = false } = {}) => {
    const astBuffer = native_js.parse(input, allowReturnOutsideFunction);
    return convertProgram(astBuffer.buffer, getReadStringFunction(astBuffer));
};
const parseAstAsync = async (input, { allowReturnOutsideFunction = false, signal } = {}) => {
    const astBuffer = await native_js.parseAsync(input, allowReturnOutsideFunction, signal);
    return convertProgram(astBuffer.buffer, getReadStringFunction(astBuffer));
};

exports.ANNOTATION_KEY = ANNOTATION_KEY;
exports.ArrowFunctionExpression = ArrowFunctionExpression;
exports.BLANK = BLANK;
exports.BlockStatement = BlockStatement;
exports.CallExpression = CallExpression;
exports.CatchClause = CatchClause;
exports.EMPTY_ARRAY = EMPTY_ARRAY;
exports.EMPTY_OBJECT = EMPTY_OBJECT;
exports.EMPTY_SET = EMPTY_SET;
exports.ExportDefaultDeclaration = ExportDefaultDeclaration;
exports.ExpressionStatement = ExpressionStatement;
exports.FIXED_STRINGS = FIXED_STRINGS;
exports.INVALID_ANNOTATION_KEY = INVALID_ANNOTATION_KEY;
exports.Identifier = Identifier;
exports.LOGLEVEL_DEBUG = LOGLEVEL_DEBUG;
exports.LOGLEVEL_ERROR = LOGLEVEL_ERROR;
exports.LOGLEVEL_INFO = LOGLEVEL_INFO;
exports.LOGLEVEL_WARN = LOGLEVEL_WARN;
exports.Literal = Literal;
exports.Program = Program;
exports.Property = Property;
exports.ReturnStatement = ReturnStatement;
exports.TemplateLiteral = TemplateLiteral;
exports.URL_AVOIDING_EVAL = URL_AVOIDING_EVAL;
exports.URL_NAME_IS_NOT_EXPORTED = URL_NAME_IS_NOT_EXPORTED;
exports.URL_OUTPUT_AMD_BASEPATH = URL_OUTPUT_AMD_BASEPATH;
exports.URL_OUTPUT_AMD_ID = URL_OUTPUT_AMD_ID;
exports.URL_OUTPUT_DIR = URL_OUTPUT_DIR;
exports.URL_OUTPUT_EXPORTS = URL_OUTPUT_EXPORTS;
exports.URL_OUTPUT_EXTERNALIMPORTATTRIBUTES = URL_OUTPUT_EXTERNALIMPORTATTRIBUTES;
exports.URL_OUTPUT_FORMAT = URL_OUTPUT_FORMAT;
exports.URL_OUTPUT_GENERATEDCODE = URL_OUTPUT_GENERATEDCODE;
exports.URL_OUTPUT_GLOBALS = URL_OUTPUT_GLOBALS;
exports.URL_OUTPUT_INLINEDYNAMICIMPORTS = URL_OUTPUT_INLINEDYNAMICIMPORTS;
exports.URL_OUTPUT_INTEROP = URL_OUTPUT_INTEROP;
exports.URL_OUTPUT_MANUALCHUNKS = URL_OUTPUT_MANUALCHUNKS;
exports.URL_OUTPUT_SOURCEMAPBASEURL = URL_OUTPUT_SOURCEMAPBASEURL;
exports.URL_OUTPUT_SOURCEMAPFILE = URL_OUTPUT_SOURCEMAPFILE;
exports.URL_PRESERVEENTRYSIGNATURES = URL_PRESERVEENTRYSIGNATURES;
exports.URL_SOURCEMAP_IS_LIKELY_TO_BE_INCORRECT = URL_SOURCEMAP_IS_LIKELY_TO_BE_INCORRECT;
exports.URL_THIS_IS_UNDEFINED = URL_THIS_IS_UNDEFINED;
exports.URL_TREATING_MODULE_AS_EXTERNAL_DEPENDENCY = URL_TREATING_MODULE_AS_EXTERNAL_DEPENDENCY;
exports.URL_TREESHAKE = URL_TREESHAKE;
exports.URL_TREESHAKE_MODULESIDEEFFECTS = URL_TREESHAKE_MODULESIDEEFFECTS;
exports.URL_WATCH = URL_WATCH;
exports.VariableDeclarator = VariableDeclarator;
exports.addTrailingSlashIfMissed = addTrailingSlashIfMissed;
exports.augmentCodeLocation = augmentCodeLocation;
exports.augmentLogMessage = augmentLogMessage;
exports.convertAnnotations = convertAnnotations;
exports.convertNode = convertNode;
exports.convertString = convertString;
exports.error = error;
exports.getAliasName = getAliasName;
exports.getImportPath = getImportPath;
exports.getReadStringFunction = getReadStringFunction;
exports.getRollupError = getRollupError;
exports.getRollupUrl = getRollupUrl;
exports.isAbsolute = isAbsolute;
exports.isPathFragment = isPathFragment;
exports.isRelative = isRelative;
exports.isValidUrl = isValidUrl;
exports.locate = locate;
exports.logAddonNotGenerated = logAddonNotGenerated;
exports.logAlreadyClosed = logAlreadyClosed;
exports.logAmbiguousExternalNamespaces = logAmbiguousExternalNamespaces;
exports.logAnonymousPluginCache = logAnonymousPluginCache;
exports.logAssetNotFinalisedForFileName = logAssetNotFinalisedForFileName;
exports.logAssetReferenceIdNotFoundForSetSource = logAssetReferenceIdNotFoundForSetSource;
exports.logAssetSourceAlreadySet = logAssetSourceAlreadySet;
exports.logBadLoader = logBadLoader;
exports.logCannotAssignModuleToChunk = logCannotAssignModuleToChunk;
exports.logCannotBundleConfigAsEsm = logCannotBundleConfigAsEsm;
exports.logCannotCallNamespace = logCannotCallNamespace;
exports.logCannotEmitFromOptionsHook = logCannotEmitFromOptionsHook;
exports.logCannotLoadConfigAsCjs = logCannotLoadConfigAsCjs;
exports.logCannotLoadConfigAsEsm = logCannotLoadConfigAsEsm;
exports.logChunkInvalid = logChunkInvalid;
exports.logChunkNotGeneratedForFileName = logChunkNotGeneratedForFileName;
exports.logCircularDependency = logCircularDependency;
exports.logCircularReexport = logCircularReexport;
exports.logConflictingSourcemapSources = logConflictingSourcemapSources;
exports.logConstVariableReassignError = logConstVariableReassignError;
exports.logCyclicCrossChunkReexport = logCyclicCrossChunkReexport;
exports.logDuplicateArgumentNameError = logDuplicateArgumentNameError;
exports.logDuplicateExportError = logDuplicateExportError;
exports.logDuplicateImportOptions = logDuplicateImportOptions;
exports.logDuplicatePluginName = logDuplicatePluginName;
exports.logEmptyChunk = logEmptyChunk;
exports.logEntryCannotBeExternal = logEntryCannotBeExternal;
exports.logEval = logEval;
exports.logExternalModulesCannotBeIncludedInManualChunks = logExternalModulesCannotBeIncludedInManualChunks;
exports.logExternalModulesCannotBeTransformedToModules = logExternalModulesCannotBeTransformedToModules;
exports.logExternalSyntheticExports = logExternalSyntheticExports;
exports.logFailAfterWarnings = logFailAfterWarnings;
exports.logFailedValidation = logFailedValidation;
exports.logFileNameConflict = logFileNameConflict;
exports.logFileReferenceIdNotFoundForFilename = logFileReferenceIdNotFoundForFilename;
exports.logFirstSideEffect = logFirstSideEffect;
exports.logIllegalIdentifierAsName = logIllegalIdentifierAsName;
exports.logIllegalImportReassignment = logIllegalImportReassignment;
exports.logImplicitDependantCannotBeExternal = logImplicitDependantCannotBeExternal;
exports.logImplicitDependantIsNotIncluded = logImplicitDependantIsNotIncluded;
exports.logImportAttributeIsInvalid = logImportAttributeIsInvalid;
exports.logImportOptionsAreInvalid = logImportOptionsAreInvalid;
exports.logIncompatibleExportOptionValue = logIncompatibleExportOptionValue;
exports.logInconsistentImportAttributes = logInconsistentImportAttributes;
exports.logInputHookInOutputPlugin = logInputHookInOutputPlugin;
exports.logInternalIdCannotBeExternal = logInternalIdCannotBeExternal;
exports.logInvalidAddonPluginHook = logInvalidAddonPluginHook;
exports.logInvalidAnnotation = logInvalidAnnotation;
exports.logInvalidExportOptionValue = logInvalidExportOptionValue;
exports.logInvalidFormatForTopLevelAwait = logInvalidFormatForTopLevelAwait;
exports.logInvalidFunctionPluginHook = logInvalidFunctionPluginHook;
exports.logInvalidLogPosition = logInvalidLogPosition;
exports.logInvalidOption = logInvalidOption;
exports.logInvalidRollupPhaseForChunkEmission = logInvalidRollupPhaseForChunkEmission;
exports.logInvalidSetAssetSourceCall = logInvalidSetAssetSourceCall;
exports.logInvalidSourcemapForError = logInvalidSourcemapForError;
exports.logLevelPriority = logLevelPriority;
exports.logMissingConfig = logMissingConfig;
exports.logMissingEntryExport = logMissingEntryExport;
exports.logMissingExport = logMissingExport;
exports.logMissingExternalConfig = logMissingExternalConfig;
exports.logMissingFileOrDirOption = logMissingFileOrDirOption;
exports.logMissingGlobalName = logMissingGlobalName;
exports.logMissingNameOptionForIifeExport = logMissingNameOptionForIifeExport;
exports.logMissingNameOptionForUmdExport = logMissingNameOptionForUmdExport;
exports.logMissingNodeBuiltins = logMissingNodeBuiltins;
exports.logMixedExport = logMixedExport;
exports.logModuleLevelDirective = logModuleLevelDirective;
exports.logModuleParseError = logModuleParseError;
exports.logNamespaceConflict = logNamespaceConflict;
exports.logNoAssetSourceSet = logNoAssetSourceSet;
exports.logNoTransformMapOrAstWithoutCode = logNoTransformMapOrAstWithoutCode;
exports.logOnlyInlineSourcemapsForStdout = logOnlyInlineSourcemapsForStdout;
exports.logOptimizeChunkStatus = logOptimizeChunkStatus;
exports.logParseError = logParseError;
exports.logPluginError = logPluginError;
exports.logRedeclarationError = logRedeclarationError;
exports.logShimmedExport = logShimmedExport;
exports.logSourcemapBroken = logSourcemapBroken;
exports.logSyntheticNamedExportsNeedNamespaceExport = logSyntheticNamedExportsNeedNamespaceExport;
exports.logThisIsUndefined = logThisIsUndefined;
exports.logUnexpectedNamedImport = logUnexpectedNamedImport;
exports.logUnexpectedNamespaceReexport = logUnexpectedNamespaceReexport;
exports.logUnknownOption = logUnknownOption;
exports.logUnresolvedEntry = logUnresolvedEntry;
exports.logUnresolvedImplicitDependant = logUnresolvedImplicitDependant;
exports.logUnresolvedImport = logUnresolvedImport;
exports.logUnresolvedImportTreatedAsExternal = logUnresolvedImportTreatedAsExternal;
exports.logUnusedExternalImports = logUnusedExternalImports;
exports.normalize = normalize;
exports.parseAst = parseAst;
exports.parseAstAsync = parseAstAsync;
exports.printQuotedStringList = printQuotedStringList;
exports.relative = relative;
exports.relativeId = relativeId;
exports.warnDeprecation = warnDeprecation;
//# sourceMappingURL=parseAst.js.map
