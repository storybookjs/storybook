import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { existsSync } from 'node:fs';

import type AST from 'estree';
import MagicString from 'magic-string';
import type { JSDocType, SvelteComponentDoc, SvelteDataItem } from 'sveltedoc-parser';
import type { PluginOption } from 'vite';
import { loadCsf } from 'storybook/internal/csf-tools';
import { normalizeStories } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { type Docgen, type Type, createDocgenCache, generateDocgen } from './generateDocgen';

/**
 * It access the AST output of _compiled_ Svelte component file. To read the name of the default
 * export - which is source of truth.
 *
 * In Svelte prior to `v4` component is a class. From `v5` is a function.
 */
function getComponentName(ast: AST.Program): string {
  // NOTE: Assertion, because rollup returns a type `AcornNode` for some reason, which doesn't overlap with `Program` from estree
  const exportDefaultDeclaration = ast.body.find((n) => n.type === 'ExportDefaultDeclaration') as
    | AST.ExportDefaultDeclaration
    | undefined;

  if (!exportDefaultDeclaration) {
    throw new Error('Unreachable - no default export found');
  }

  // NOTE: Output differs based on svelte version and dev/prod mode

  if (exportDefaultDeclaration.declaration.type === 'Identifier') {
    return exportDefaultDeclaration.declaration.name;
  }

  if (
    exportDefaultDeclaration.declaration.type !== 'ClassDeclaration' &&
    exportDefaultDeclaration.declaration.type !== 'FunctionDeclaration'
  ) {
    throw new Error('Unreachable - not a class or a function');
  }

  if (!exportDefaultDeclaration.declaration.id) {
    throw new Error('Unreachable - unnamed class/function');
  }

  return exportDefaultDeclaration.declaration.id.name;
}

function transformToSvelteDocParserType(type: Type): JSDocType {
  switch (type.type) {
    case 'string':
      return { kind: 'type', type: 'string', text: 'string' };
    case 'number':
      return { kind: 'type', type: 'number', text: 'number' };
    case 'boolean':
      return { kind: 'type', type: 'boolean', text: 'boolean' };
    case 'symbol':
      return { kind: 'type', type: 'other', text: 'symbol' };
    case 'null':
      return { kind: 'type', type: 'other', text: 'null' };
    case 'undefined':
      return { kind: 'type', type: 'other', text: 'undefined' };
    case 'void':
      return { kind: 'type', type: 'other', text: 'void' };
    case 'any':
      return { kind: 'type', type: 'any', text: 'any' };
    case 'object':
      return { kind: 'type', type: 'object', text: type.text };
    case 'array':
      return { kind: 'type', type: 'array', text: type.text };
    case 'function':
      return { kind: 'function', text: type.text };
    case 'literal':
      return { kind: 'const', type: typeof type.value, value: type.value, text: type.text };
    case 'union': {
      const nonNull = type.types.filter((t) => t.type !== 'null'); // ignore null
      const text = nonNull.map((t): string => transformToSvelteDocParserType(t).text).join(' | ');
      const types = nonNull.map((t) => transformToSvelteDocParserType(t));
      return types.length === 1 ? types[0] : { kind: 'union', type: types, text };
    }
    case 'intersection': {
      const text = type.types
        .map((t): string => transformToSvelteDocParserType(t).text)
        .join(' & ');
      return { kind: 'type', type: 'intersection', text };
    }
  }
}

/** Mimic sveltedoc-parser's props data structure */
function transformToSvelteDocParserDataItems(docgen: Docgen): SvelteDataItem[] {
  return docgen.props.map((p) => {
    const required = p.optional === false && p.defaultValue === undefined;
    return {
      name: p.name,
      visibility: 'public',
      description: p.description,
      keywords: required ? [{ name: 'required', description: '' }] : [],
      kind: 'let',
      type: p.type ? transformToSvelteDocParserType(p.type) : undefined,
      static: false,
      readonly: false,
      importPath: undefined,
      originalName: undefined,
      localName: undefined,
      defaultValue: p.defaultValue ? p.defaultValue.text : undefined,
    } satisfies SvelteDataItem;
  });
}

/**
 * Resolves an import path relative to a base file
 */
function resolveImportPath(importPath: string, baseFilePath: string): string | null {
  if (isAbsolute(importPath)) {
    return importPath;
  }

  const baseDir = dirname(baseFilePath);
  let resolvedPath = resolve(baseDir, importPath);

  // Try different extensions for the resolved path
  const extensions = ['', '.svelte', '.js', '.ts', '.mjs'];
  
  for (const ext of extensions) {
    // Check if the path exists with the extension
    const pathWithExt = resolvedPath + ext;
    if (existsSync(pathWithExt)) {
      return pathWithExt;
    }
    
    // Also try index files in directory
    const indexPath = join(resolvedPath, `index${ext}`);
    if (existsSync(indexPath)) {
      return indexPath;
    }
  }

  return null;
}

/**
 * Extracts component references from Svelte CSF files and returns both the path and component name
 */
function extractSvelteCSFComponentRef(content: string, filePath: string): { path: string; componentName: string } | null {
  // Parse Svelte CSF format: import { defineMeta } from '@storybook/addon-svelte-csf'
  // Look for defineMeta({ component: Button, ... })
  const defineMetaMatch = content.match(/defineMeta\s*\(\s*\{([^}]+)\}/);
  if (!defineMetaMatch) {
    return null;
  }

  const metaContent = defineMetaMatch[1];
  const componentMatch = metaContent.match(/component\s*:\s*([^,\s}]+)/);
  if (!componentMatch) {
    return null;
  }

  const componentName = componentMatch[1].trim();
  
  // Find the import for this component
  const importRegex = new RegExp(`import\\s+(?:{[^}]*\\b${componentName}\\b[^}]*}|${componentName})\\s+from\\s+['"]([^'"]+)['"]`);
  const importMatch = content.match(importRegex);
  
  if (importMatch) {
    const importPath = importMatch[1];
    const resolvedPath = resolveImportPath(importPath, filePath);
    if (resolvedPath) {
      return { path: resolvedPath, componentName };
    }
  }

  return null;
}

/**
 * Collects component file paths referenced in story files using Storybook's configured story patterns
 */
async function collectReferencedComponents(options: Options): Promise<Set<string>> {
  const referencedComponents = new Set<string>();

  // Get story patterns from Storybook configuration via presets
  const storySpecifiers = normalizeStories(await options.presets.apply('stories', [], options), {
    configDir: options.configDir,
    workingDir: options.configDir,
  });

  let storyFiles: string[] = [];
  
  // Dynamically import globby because it is a pure ESM module
  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');
  
  // Use the configured story patterns instead of hardcoded ones
  for (const { directory, files } of storySpecifiers) {
    const pattern = join(directory, files);
    const absolutePattern = isAbsolute(pattern) ? pattern : join(options.configDir, pattern);
    
    try {
      const files = await globby(absolutePattern, {
        ignore: ['**/node_modules/**'],
        absolute: true,
      });
      storyFiles = storyFiles.concat(files);
    } catch (e) {
      // Ignore glob errors
    }
  }

  // Process each story file
  for (const storyFile of storyFiles) {
    try {
      const content = await readFile(storyFile, 'utf-8');
      const ext = extname(storyFile);

      // Handle Svelte CSF format
      if (ext === '.svelte') {
        const componentRef = extractSvelteCSFComponentRef(content, storyFile);
        if (componentRef) {
          referencedComponents.add(componentRef.path);
          // Follow transitive imports for barrel exports
          const transitiveComponents = await followTransitiveImports(componentRef.path, componentRef.componentName);
          transitiveComponents.forEach(comp => referencedComponents.add(comp));
        }
        continue;
      }

      // Handle regular CSF files (JS/TS)
      try {
        const csfFile = loadCsf(content, { fileName: storyFile, makeTitle: (title: string) => title });
        const parsed = csfFile.parse();
        
        if (parsed.meta && csfFile._rawComponentPath) {
          const resolvedPath = resolveImportPath(csfFile._rawComponentPath, storyFile);
          if (resolvedPath) {
            referencedComponents.add(resolvedPath);
            
            // Extract component name from the raw component path
            const componentNameMatch = content.match(/component\s*:\s*([^,\s}]+)/);
            const componentName = componentNameMatch ? componentNameMatch[1].trim() : undefined;
            
            // Follow transitive imports for barrel exports
            const transitiveComponents = await followTransitiveImports(resolvedPath, componentName);
            transitiveComponents.forEach(comp => referencedComponents.add(comp));
          }
        }
      } catch (e) {
        // If CSF parsing fails, fall back to regex parsing
        const componentMatch = content.match(/component\s*:\s*([^,\s}]+)/);
        if (componentMatch) {
          const componentName = componentMatch[1].trim();
          
          // Find the import for this component
          const importRegex = new RegExp(`import\\s+(?:{[^}]*\\b${componentName}\\b[^}]*}|${componentName})\\s+from\\s+['"]([^'"]+)['"]`);
          const importMatch = content.match(importRegex);
          
          if (importMatch) {
            const importPath = importMatch[1];
            const resolvedPath = resolveImportPath(importPath, storyFile);
            if (resolvedPath) {
              referencedComponents.add(resolvedPath);
              const transitiveComponents = await followTransitiveImports(resolvedPath, componentName);
              transitiveComponents.forEach(comp => referencedComponents.add(comp));
            }
          }
        }
      }
    } catch (e) {
      // Ignore file read errors
    }
  }

  return referencedComponents;
}

/**
 * Follows transitive imports to handle barrel exports for a specific component and returns found component paths
 */
async function followTransitiveImports(filePath: string, componentName?: string): Promise<Set<string>> {
  const foundComponents = new Set<string>();
  
  if (!filePath.endsWith('.svelte')) {
    try {
      const content = await readFile(filePath, 'utf-8');
      
      if (componentName) {
        // Look for specific named export: export { Button } from './Button.svelte'
        const namedExportRegex = new RegExp(`export\\s+\\{[^}]*\\b${componentName}\\b[^}]*\\}\\s+from\\s+['"]([^'"]+)['"]`);
        const namedExportMatch = content.match(namedExportRegex);
        if (namedExportMatch) {
          const importPath = namedExportMatch[1];
          const resolvedPath = resolveImportPath(importPath, filePath);
          if (resolvedPath) {
            if (resolvedPath.endsWith('.svelte')) {
              foundComponents.add(resolvedPath);
            } else {
              // Recursively follow barrel exports
              const nestedComponents = await followTransitiveImports(resolvedPath, componentName);
              nestedComponents.forEach(comp => foundComponents.add(comp));
            }
          }
        }
        
        // Look for default export re-export: export { default as Button } from './Button.svelte'
        const defaultExportRegex = new RegExp(`export\\s+\\{\\s*default\\s+as\\s+${componentName}\\s*\\}\\s+from\\s+['"]([^'"]+)['"]`);
        const defaultExportMatch = content.match(defaultExportRegex);
        if (defaultExportMatch) {
          const importPath = defaultExportMatch[1];
          const resolvedPath = resolveImportPath(importPath, filePath);
          if (resolvedPath) {
            if (resolvedPath.endsWith('.svelte')) {
              foundComponents.add(resolvedPath);
            } else {
              // Recursively follow barrel exports
              const nestedComponents = await followTransitiveImports(resolvedPath, 'default');
              nestedComponents.forEach(comp => foundComponents.add(comp));
            }
          }
        }
        
        // Look for import/export combinations for specific component
        const importExportRegex = new RegExp(`import\\s+(?:\\{[^}]*\\b${componentName}\\b[^}]*\\}|${componentName})\\s+from\\s+['"]([^'"]+)['"];?(?:\\s*export\\s+(?:\\{[^}]*\\b${componentName}\\b[^}]*\\}|${componentName}))?`);
        const importExportMatch = content.match(importExportRegex);
        if (importExportMatch) {
          const importPath = importExportMatch[1];
          const resolvedPath = resolveImportPath(importPath, filePath);
          if (resolvedPath) {
            if (resolvedPath.endsWith('.svelte')) {
              foundComponents.add(resolvedPath);
            } else {
              // Recursively follow barrel exports
              const nestedComponents = await followTransitiveImports(resolvedPath, componentName);
              nestedComponents.forEach(comp => foundComponents.add(comp));
            }
          }
        }
      } else {
        // Fallback: look for all re-exports if no specific component name
        const reExportMatches = content.matchAll(/export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g);
        for (const match of reExportMatches) {
          const importPath = match[1];
          const resolvedPath = resolveImportPath(importPath, filePath);
          if (resolvedPath && resolvedPath.endsWith('.svelte')) {
            foundComponents.add(resolvedPath);
          }
        }
      }
    } catch (e) {
      // Ignore file read errors
    }
  }
  
  return foundComponents;
}

export async function svelteDocgen(options?: Options): Promise<PluginOption> {
  const include = /\.svelte$/;
  const exclude = /node_modules\/.*|\.stories?\.(js|jsx|ts|tsx|mjs|svelte)$/;
  const { createFilter } = await import('vite');

  const baseFilter = createFilter(include, exclude);
  const sourceFileCache = createDocgenCache();
  
  // Collect referenced components on first run to optimize docgen processing.
  // Only components that are actually referenced in story files will have docgen generated.
  // This significantly improves performance by avoiding expensive docgen on unused components.
  let referencedComponents: Set<string> | null = null;
  
  const refreshReferencedComponents = async () => {
    if (options) {
      referencedComponents = await collectReferencedComponents(options);
    }
    return referencedComponents || new Set<string>();
  };
  
  const getReferencedComponents = async () => {
    if (!referencedComponents) {
      return await refreshReferencedComponents();
    }
    return referencedComponents;
  };

  return {
    name: 'storybook:svelte-docgen-plugin',
    
    async buildStart() {
      // Initialize component reference collection on build start
      await refreshReferencedComponents();
    },
    
    async handleHotUpdate(ctx) {
      // Check if the updated file is a story file or component file
      const isStoryFile = /\.stories?\.(js|jsx|ts|tsx|mjs|svelte)$/.test(ctx.file);
      const isComponentFile = /\.svelte$/.test(ctx.file) && !isStoryFile;
      
      if (isStoryFile) {
        // If a story file changed, refresh the component reference list
        await refreshReferencedComponents();
      } else if (isComponentFile) {
        // If a component file changed and it's in our referenced list, allow normal HMR
        const normalizedPath = resolve(ctx.file);
        const components = await getReferencedComponents();
        if (components.has(normalizedPath)) {
          // Let Vite handle the HMR for referenced components
          return;
        }
      }
      
      // For other files, let Vite handle normally
      return;
    },
    
    async transform(src: string, id: string) {
      // Skip files with virtual module prefix or files that don't match base filter (includes story files)
      if (id.startsWith('\0') || !baseFilter(id)) {
        return undefined;
      }

      // Get the list of referenced components
      const components = await getReferencedComponents();
      
      // Only process files that are actually referenced in stories
      const normalizedId = resolve(id);
      if (!components.has(normalizedId)) {
        return undefined;
      }

      const resource = relative(process.cwd(), id);

      // Get props information
      const docgen = generateDocgen(resource, sourceFileCache);
      const data = transformToSvelteDocParserDataItems(docgen);

      const componentDoc: SvelteComponentDoc & { keywords?: string[] } = {
        data: data,
        name: basename(resource),
      };

      const s = new MagicString(src);
      const outputAst = this.parse(src);
      const componentName = getComponentName(outputAst as unknown as AST.Program);
      s.append(`\n;${componentName}.__docgen = ${JSON.stringify(componentDoc)}`);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}
