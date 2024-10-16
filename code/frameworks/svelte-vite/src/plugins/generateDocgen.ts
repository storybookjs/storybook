import path from 'node:path';

import svelte2tsx from 'svelte2tsx';
import { VERSION } from 'svelte/compiler';
import ts from 'typescript';

export type Docgen = {
  name?: string;
  propsRuneUsed?: boolean;
  props: PropInfo[];
};

export type PropInfo = {
  name: string;
  type?: Type;
  optional?: boolean;
  defaultValue?: DefaultValue;
  description?: string;
};

type BaseType = object;

type ScalarType = BaseType & {
  type: 'number' | 'string' | 'boolean' | 'symbol' | 'any' | 'null' | 'undefined' | 'void';
};
type FunctionType = BaseType & {
  type: 'function';
  text: string;
};
type LiteralType = BaseType & {
  type: 'literal';
  value: string | number | boolean;
  text: string;
};
type ArrayType = BaseType & {
  type: 'array';
  text: string;
};
type ObjectType = BaseType & {
  type: 'object';
  text: string;
};
type UnionType = BaseType & {
  type: 'union';
  types: Type[];
};
type IntersectionType = BaseType & {
  type: 'intersection';
  types: Type[];
};

export type Type =
  | ScalarType
  | LiteralType
  | FunctionType
  | ArrayType
  | ObjectType
  | UnionType
  | IntersectionType;

type DefaultValue = {
  text: string;
};

function convertType(type: ts.Type, checker: ts.TypeChecker): Type | undefined {
  // TypeScript compiler uses bit flags to represent type information.
  // Note the use of the bitwise AND (&) operator here.
  // See examples at: https://github.com/search?q=repo%3Amicrosoft%2FTypeScript+TypeFlags.&type=code
  if (type.flags & ts.TypeFlags.Any) {
    return { type: 'any' };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return { type: 'number' };
  }
  if (type.flags & ts.TypeFlags.String) {
    return { type: 'string' };
  }
  if (type.flags & ts.TypeFlags.Boolean) {
    return { type: 'boolean' };
  }
  if (type.flags & ts.TypeFlags.ESSymbol) {
    return { type: 'symbol' };
  }
  if (type.flags & ts.TypeFlags.Null) {
    return { type: 'null' };
  }
  if (type.flags & ts.TypeFlags.Undefined) {
    return { type: 'undefined' };
  }
  if (type.flags & ts.TypeFlags.Void) {
    return { type: 'void' };
  }
  if (type.getCallSignatures().length > 0) {
    return { type: 'function', text: checker.typeToString(type) };
  }
  if (type.flags & ts.TypeFlags.Object) {
    const indexType = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
    if (indexType) {
      return { type: 'array', text: checker.typeToString(type) };
    }
    return { type: 'object', text: checker.typeToString(type) };
  }
  if (type.isNumberLiteral() || type.isStringLiteral()) {
    return {
      type: 'literal',
      value: type.value,
      text:
        type.flags & ts.TypeFlags.EnumLiteral
          ? checker.typeToString(type)
          : JSON.stringify(type.value),
    };
  }
  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    const text = checker.typeToString(type);
    return { type: 'literal', value: text === 'true', text: text };
  }
  if (type.isUnion()) {
    // TypeA | TypeB
    const types = type.types
      .map((t) => convertType(t, checker))
      .filter((t) => {
        return t !== undefined && t.type !== 'undefined';
      }) as Type[];

    // Boolean is represented as 'true' | 'false' in TypeScript's type checker,
    // so we need to merge them into a single 'boolean' type.
    const idxTrue = types.findIndex((t) => t.type === 'literal' && t.value === true);
    const idxFalse = types.findIndex((t) => t.type === 'literal' && t.value === false);
    if (idxTrue !== -1 && idxFalse !== -1) {
      types.splice(Math.max(idxTrue, idxFalse), 1);
      types.splice(Math.min(idxTrue, idxFalse), 1, { type: 'boolean' });
    }

    return types.length > 1 ? { type: 'union', types: types } : types[0];
  }
  if (type.isIntersection()) {
    // TypeA & TypeB
    const types = type.types
      .map((t) => convertType(t, checker))
      .filter((t) => t !== undefined) as Type[];
    return { type: 'intersection', types };
  }

  return undefined;
}

function initializerToDefaultValue(
  expr: ts.Expression,
  checker: ts.TypeChecker
): DefaultValue | undefined {
  if (ts.isNumericLiteral(expr)) {
    return { text: expr.text };
  } else if (ts.isStringLiteral(expr)) {
    return { text: JSON.stringify(expr.text) };
  } else if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr)) {
    const symbol = checker.getSymbolAtLocation(expr);
    if (symbol && checker.isUndefinedSymbol(symbol)) {
      return undefined;
    }
    const type = checker.getTypeAtLocation(expr);
    if (type.flags & ts.TypeFlags.EnumLiteral) {
      return { text: checker.typeToString(type) };
    } else if (type.isLiteral()) {
      // string or number
      return { text: JSON.stringify(type.value) };
    } else if (type.flags & ts.TypeFlags.Null) {
      return { text: 'null' };
    } else if (type.flags & ts.TypeFlags.BooleanLiteral) {
      return { text: checker.typeToString(type) };
    } else if (type.getCallSignatures().length > 0) {
      return { text: 'function' };
    }
  } else if (
    ts.isArrayLiteralExpression(expr) ||
    ts.isObjectLiteralExpression(expr) ||
    ts.isNewExpression(expr)
  ) {
    return { text: expr.getText() };
  } else if (ts.isArrowFunction(expr)) {
    return { text: 'function' };
  }
  switch (expr.kind) {
    case ts.SyntaxKind.TrueKeyword:
      return { text: 'true' };
    case ts.SyntaxKind.FalseKeyword:
      return { text: 'false' };
    case ts.SyntaxKind.NullKeyword:
      return { text: 'null' };
  }
  return { text: '...' };
}

function loadConfig(basepath: string): [ts.CompilerOptions, Set<string>] {
  const configPath =
    ts.findConfigFile(basepath, ts.sys.fileExists) ||
    ts.findConfigFile(basepath, ts.sys.fileExists, 'jsconfig.json');

  const forcedOptions = {
    sourceMap: false,
    noEmit: true,
    strict: true,
    allowJs: true,
    checkJs: true,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
  };
  if (!configPath) {
    return [forcedOptions, new Set()];
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
    undefined,
    [
      {
        extension: 'svelte',
        isMixedContent: true,
        scriptKind: ts.ScriptKind.Deferred,
      },
    ]
  );

  const fileNames = new Set(
    config.fileNames
      .filter((fileName) => fileName.endsWith('.svelte'))
      .map((fileName) => fileName + '.tsx')
  );

  return [
    {
      ...config.options,
      ...forcedOptions,
    },
    fileNames,
  ];
}

export interface DocgenCache {
  filenameToModifiedTime: Record<string, Date | undefined>;
  filenameToSourceFile: Record<string, ts.SourceFile>;
  fileCache: Record<string, string>;
  oldProgram?: ts.Program;
  options?: ts.CompilerOptions;
  rootNames?: Set<string>;
}

export function createDocgenCache(): DocgenCache {
  return {
    filenameToModifiedTime: {},
    filenameToSourceFile: {},
    fileCache: {},
  };
}

export function generateDocgen(targetFileName: string, cache: DocgenCache): Docgen {
  if (targetFileName.endsWith('.svelte')) {
    targetFileName = targetFileName + '.tsx';
  }
  let propsRuneUsed = false;

  if (cache.options === undefined || !cache.rootNames?.has(targetFileName)) {
    [cache.options, cache.rootNames] = loadConfig(targetFileName);

    const shimFilename = require.resolve('svelte2tsx/svelte-shims-v4.d.ts');
    cache.rootNames.add(shimFilename);
    cache.rootNames.add(targetFileName);
  }

  // Create a custom host
  const originalHost = ts.createCompilerHost(cache.options);
  const host: ts.CompilerHost = {
    ...originalHost,
    readFile(fileName) {
      // Cache package.json
      const isCacheTarget = fileName.endsWith(path.sep + 'package.json');
      if (isCacheTarget && cache.fileCache[fileName]) {
        return cache.fileCache[fileName];
      }
      const content = originalHost.readFile(fileName);
      if (content && isCacheTarget) {
        cache.fileCache[fileName] = content;
      }
      return content;
    },
    fileExists(fileName) {
      const isCacheTarget = fileName.endsWith(path.sep + 'package.json');
      if (isCacheTarget && cache.fileCache[fileName]) {
        return true;
      }

      let exists = originalHost.fileExists(fileName);
      if (exists) {
        return exists;
      }

      // Virtual .svelte.tsx file
      if (fileName.endsWith('.svelte.tsx') || fileName.endsWith('.svelte.jsx')) {
        fileName = fileName.slice(0, -4); // remove .tsx or .jsx
        exists = originalHost.fileExists(fileName);
        return exists;
      }

      return false;
    },
    getSourceFile(fileName, languageVersion, onError) {
      if (fileName.endsWith('.svelte.tsx') || fileName.endsWith('.svelte.jsx')) {
        // .svelte file (`import ... from './path/to/file.svelte'`)

        const realFileName = fileName.slice(0, -4); // remove .tsx or .jsx

        const modifiedTime: Date | undefined = ts.sys.getModifiedTime
          ? ts.sys.getModifiedTime(realFileName)
          : undefined;
        if (modifiedTime) {
          const cachedModifiedTime = cache.filenameToModifiedTime[fileName];
          if (cachedModifiedTime?.getTime() === modifiedTime.getTime()) {
            return cache.filenameToSourceFile[fileName];
          }
        }

        const content = originalHost.readFile(realFileName);
        if (content === undefined) {
          return;
        }

        const isTsFile = /<script\s+[^>]*?lang=('|")(ts|typescript)('|")/.test(content);

        const tsx = svelte2tsx.svelte2tsx(content, {
          version: VERSION,
          isTsFile,
          mode: 'dts',
        });

        const sourceFile = ts.createSourceFile(
          fileName,
          tsx.code,
          languageVersion,
          true,
          isTsFile ? ts.ScriptKind.TS : ts.ScriptKind.JS // Set to 'JS' to enable TypeScript to parse JSDoc.
        );

        // update cache
        cache.filenameToSourceFile[fileName] = sourceFile;
        cache.filenameToModifiedTime[fileName] = modifiedTime;

        return sourceFile;
      } else {
        // non-svelte file

        let staticCaching = false;
        staticCaching ||= fileName
          .split(path.sep)
          .some((part) => part.toLowerCase() === 'node_modules');

        // We can significantly speed up the docgen process by caching source files.
        const cachedSourceFile = cache.filenameToSourceFile[fileName];
        if (cachedSourceFile && staticCaching) {
          return cachedSourceFile;
        }
        const modifiedTime: Date | undefined = ts.sys.getModifiedTime
          ? ts.sys.getModifiedTime(fileName)
          : undefined;
        if (modifiedTime) {
          const cachedModifiedTime = cache.filenameToModifiedTime[fileName];
          if (cachedModifiedTime?.getTime() === modifiedTime.getTime()) {
            return cache.filenameToSourceFile[fileName];
          }
        }

        const content = originalHost.readFile(fileName);
        if (content === undefined) {
          return;
        }

        const sourceFile = ts.createSourceFile(fileName, content, languageVersion, true);

        // update cache
        cache.filenameToSourceFile[fileName] = sourceFile;
        cache.filenameToModifiedTime[fileName] = modifiedTime;

        return sourceFile;
      }
    },
    writeFile() {
      // Write nothing
    },
  };

  const program = ts.createProgram({
    rootNames: Array.from(cache.rootNames),
    options: cache.options,
    host,
    oldProgram: cache.oldProgram,
  });
  cache.oldProgram = program;

  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(targetFileName);
  if (sourceFile === undefined) {
    return {
      props: [],
    };
  }

  const propMap: Map<string, PropInfo> = new Map();

  // Get render function generated by svelte2tsx
  const renderFunction = sourceFile.statements.find((statement) => {
    return ts.isFunctionDeclaration(statement) && statement.name?.text === 'render';
  }) as ts.FunctionDeclaration | undefined;
  if (renderFunction === undefined) {
    return {
      props: [],
    };
  }

  let propsType: ts.Type | undefined;

  const signature = checker.getSignatureFromDeclaration(renderFunction);

  if (signature && signature.declaration) {
    // Get props type from ReturnType<render>
    const type = checker.getReturnTypeOfSignature(signature);

    type.getProperties().forEach((retObjProp) => {
      if (retObjProp.name === 'props') {
        const decl = signature.getDeclaration();
        propsType = checker.getTypeOfSymbolAtLocation(retObjProp, decl);
        propsType.getProperties().forEach((prop) => {
          const name = prop.getName();
          let description =
            ts.displayPartsToString(prop.getDocumentationComment(checker)) || undefined;

          // Infer prop type
          const propType = checker.getTypeOfSymbolAtLocation(prop, decl);

          if (prop.valueDeclaration) {
            // Comment from JSDoc '@type {type} comment'
            const typeTag = ts.getJSDocTypeTag(prop.valueDeclaration);
            if (typeTag?.comment) {
              description = ((description || '') + '\n' + typeTag.comment).trim();
            }
          }

          // Ignore props from svelte/elements.d.ts (HTMLAttributes, AriaAttributes and DOMAttributes).
          // Some libraries use these for {...$$restProps}
          if (
            prop.valueDeclaration
              ?.getSourceFile()
              .fileName.includes('node_modules/svelte/elements.d.ts')
          ) {
            return;
          }

          // Check if this prop is optional
          const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
          propMap.set(name, {
            name,
            optional,
            description,
            type: convertType(propType, checker),
          });
        });
      }
    });
  }

  renderFunction.body?.forEachChild((node) => {
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((declaration) => {
        // Extract default values from:
        //     let { <name> = <defaultValue>, ... }: <propsType> = $props();

        if (ts.isObjectBindingPattern(declaration.name)) {
          const isPropsRune =
            declaration.initializer &&
            ts.isCallExpression(declaration.initializer) &&
            ts.isIdentifier(declaration.initializer.expression) &&
            declaration.initializer.expression.text === '$props';

          const isPropsType =
            declaration.type && propsType === checker.getTypeFromTypeNode(declaration.type);

          if (isPropsRune || isPropsType) {
            propsRuneUsed = true;
            declaration.name.elements.forEach((element) => {
              const name = element.name.getText();
              const prop = propMap.get(name);
              if (prop && element.initializer) {
                const defaultValue = initializerToDefaultValue(element.initializer, checker);
                if (defaultValue) {
                  prop.defaultValue = defaultValue;
                }
              }
            });
          }
        }

        // Extract default values from:
        //    export let <name> = <defaultValue>
        if (
          ts.isVariableDeclaration(declaration) &&
          ts.isIdentifier(declaration.name) &&
          propMap.has(declaration.name.text)
        ) {
          const prop = propMap.get(declaration.name.text);
          if (prop && declaration.initializer) {
            prop.optional = true;
            const defaultValue = initializerToDefaultValue(declaration.initializer, checker);
            if (defaultValue) {
              prop.defaultValue = defaultValue;
            }
          }
        }
      });
    }
  });

  return {
    props: Array.from(propMap.values()),
    propsRuneUsed,
  };
}
