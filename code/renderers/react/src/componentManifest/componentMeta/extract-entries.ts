/**
 * The extraction loop over a batch of story entries, shared by the compiler-API and native-API
 * projects. The project supplies the checker and the program of its current state; this module
 * resolves each entry's component and writes the serialized doc back onto the entry.
 *
 * A generic component's props are not resolvable from its own file: the first parameter stays
 * `Props<T>` until a call site instantiates it. The story's JSX gives a resolved call signature, so
 * it is tried first, and a story with no JSX falls back to the component's own export. Nothing else
 * needs the use site - forwardRef, memo, styled() and HOC wrappers all resolve the same either way.
 *
 * The first matching JSX element wins, so for a component rendered with different type arguments
 * across stories, the documented type is the one the earliest story pins.
 */
import { logger } from 'storybook/internal/node-logger';

import type ts from 'typescript';

import type { StoryRef } from '../getComponentImports.ts';
import type { ComponentRef, ResolvedComponentTarget } from '../types.ts';
import {
  metaComponentMatchesRef,
  resolvePropsFromComponentExport,
  resolvePropsFromComponentType,
  resolvePropsFromStoryFile,
  serializeComponentDoc,
} from './componentMetaExtractor.ts';
import type { DocgenTypeChecker, DocgenTypeScript } from '@storybook/component-meta-typescript';

export interface ExtractionContext {
  typescript: DocgenTypeScript;
  checker: DocgenTypeChecker;
  program: { getSourceFile(fileName: string): ts.SourceFile | undefined };
  /** Resolve a package import of a story file to the file TypeScript resolved it to. */
  resolveModule(importId: string, fromFile: string): string | undefined;
}

const isDeclarationFile = (fileName: string) =>
  fileName.endsWith('.d.ts') || fileName.endsWith('.d.mts') || fileName.endsWith('.d.cts');

/** Extract the props of every entry's component and store the docs on the entries. */
export function extractEntries(
  { typescript, checker, program, resolveModule }: ExtractionContext,
  entries: StoryRef[]
): void {
  const serializationContextByComponentPath = new Map<
    string,
    { sourceFile: ts.SourceFile; defaultsSourcePath?: string }
  >();

  for (const entry of entries) {
    try {
      const storySourceFile = program.getSourceFile(entry.storyPath);
      const entryComponent = entry.component;
      const componentPath = entryComponent?.path;
      const exportName = entryComponent?.importName;
      if (!storySourceFile || !componentPath || !exportName || !entryComponent) {
        continue;
      }

      const importId = entryComponent.importId;
      const isPackageImport = importId && !importId.startsWith('.');
      const componentSourceFile = program.getSourceFile(
        (isPackageImport && resolveModule(importId, entry.storyPath)) || componentPath
      );
      if (!componentSourceFile) {
        continue;
      }

      // Path 1: Find JSX in story file
      let resolvedComponent: ResolvedComponentTarget | undefined;
      if (importId) {
        resolvedComponent = resolvePropsFromStoryFile(
          typescript,
          checker,
          storySourceFile,
          entryComponent
        );
      }

      // Path 2: Fallback - resolve from meta.component in the story file.
      // Only fires when the user explicitly set `component:` in the meta object.
      // Only applies to the meta component itself, not declared subcomponents.
      if (!resolvedComponent) {
        resolvedComponent = resolveFromMetaComponent(
          typescript,
          checker,
          storySourceFile,
          entryComponent
        );
      }

      // Path 3: Resolve directly from the component module export (declared subcomponents).
      if (!resolvedComponent) {
        resolvedComponent = resolvePropsFromComponentExport(
          typescript,
          checker,
          componentSourceFile,
          entryComponent
        );
      }

      if (!resolvedComponent) {
        continue;
      }

      let serializationContext = serializationContextByComponentPath.get(componentPath);
      if (serializationContext === undefined) {
        serializationContext = {
          sourceFile: componentSourceFile,
          defaultsSourcePath: isDeclarationFile(componentSourceFile.fileName)
            ? componentPath
            : undefined,
        };
        serializationContextByComponentPath.set(componentPath, serializationContext);
      }

      const doc = serializeComponentDoc(typescript, checker, {
        sourceFile: serializationContext.sourceFile,
        resolvedComponent,
        defaultsSourcePath: serializationContext.defaultsSourcePath,
      });

      if (doc) {
        entryComponent.reactComponentMeta = doc;
        entryComponent.componentJsDocTags = doc.jsDocTags;
        entryComponent.importOverride = entryComponent.componentJsDocTags?.import?.[0]?.trim();
      }
    } catch (error) {
      // One bad component should not kill the entire batch.
      logger.debug(`[reactComponentMeta] Extraction failed for ${entry.storyPath}: ${error}`);
      continue;
    }
  }
}

/**
 * Path 2 fallback: resolve the component type from the story file's `meta.component` property. Only
 * works when the user explicitly set `component:` in the meta - no node means no extraction.
 */
function resolveFromMetaComponent(
  typescript: DocgenTypeScript,
  checker: DocgenTypeChecker,
  storySourceFile: ts.SourceFile,
  componentRef: ComponentRef
): ResolvedComponentTarget | undefined {
  const { member: memberAccess } = componentRef;
  const moduleSymbol = checker.getSymbolAtLocation(storySourceFile);
  if (!moduleSymbol) {
    return undefined;
  }

  const defaultExport = checker
    .getExportsOfModule(moduleSymbol)
    .find((e) => e.getName() === 'default');
  if (!defaultExport) {
    return undefined;
  }

  const metaType = checker.getTypeOfSymbol(defaultExport);
  const componentProp = metaType.getProperty('component');
  if (
    !componentProp?.valueDeclaration ||
    !typescript.isPropertyAssignment(componentProp.valueDeclaration)
  ) {
    return undefined;
  }

  const metaComponentInitializer = componentProp.valueDeclaration.initializer;
  if (
    !metaComponentInitializer ||
    !metaComponentMatchesRef(
      typescript,
      checker,
      storySourceFile,
      componentRef,
      metaComponentInitializer
    )
  ) {
    return undefined;
  }

  let componentType = checker.getTypeOfSymbol(componentProp);
  let selectedSymbol = checker.getSymbolAtLocation(metaComponentInitializer);

  if (memberAccess) {
    const prop = componentType.getProperty(memberAccess);
    if (prop) {
      componentType = checker.getTypeOfSymbol(prop);
      selectedSymbol = prop;
    } else {
      return undefined;
    }
  }

  const propsType = resolvePropsFromComponentType(typescript, checker, componentType);
  if (!propsType || !selectedSymbol) {
    return undefined;
  }

  return {
    componentRef,
    propsType,
    symbol: selectedSymbol,
  };
}
