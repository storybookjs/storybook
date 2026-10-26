/**
 * Canonical component-level JSDoc extraction for the TS-backed docgen providers.
 *
 * TypeScript's own JSDoc semantics are the contract: whatever `getDocumentationComment` /
 * `getJsDocTags` report is what Storybook documents, matching IDE hovers. Notably, a bare
 * `@tag` preceded by whitespace starts a tag even mid-sentence, while braced inline tags
 * (`{@link Foo}`) stay in the description.
 *
 * Like the rest of this module, no type here names the `typescript` package: callers pass their
 * own `typescript` module and checker, which satisfy these structural subsets.
 *
 * Docblocks with no TS symbol (CSF story/meta docblocks, TS-less docgen engines) are parsed by
 * `csf-tools`' `extractJSDocInfo` instead, whose semantics differ on malformed input.
 */

/** Structural subset of `ts.SymbolDisplayPart`. */
export interface JsDocDisplayPart {
  text: string;
  kind: string;
}

/** Structural subset of `ts.JSDocTagInfo`. */
export interface JsDocTagInfoLike {
  name: string;
  text?: JsDocDisplayPart[];
}

/** Structural subset of `ts.Symbol` used for export resolution. */
export interface JsDocExportSymbolLike {
  flags: number;
  getName(): string;
}

/** Structural subset of `ts.Symbol` — the two documentation accessors. */
export interface JsDocSymbolLike<TChecker> extends JsDocExportSymbolLike {
  getDocumentationComment(typeChecker: TChecker | undefined): JsDocDisplayPart[];
  getJsDocTags(checker?: TChecker): JsDocTagInfoLike[];
}

/** The part of the `typescript` module the extractor needs. */
export interface JsDocHost {
  SymbolFlags: { Alias: number };
  displayPartsToString(displayParts: JsDocDisplayPart[] | undefined): string;
}

/** Structural subset of `ts.TypeChecker` used for export resolution. */
export interface JsDocExportCheckerLike<TSourceFile, TSymbol extends JsDocExportSymbolLike> {
  getAliasedSymbol(symbol: TSymbol): TSymbol;
  getExportsOfModule(moduleSymbol: TSymbol): TSymbol[];
  getSymbolAtLocation(node: TSourceFile): TSymbol | undefined;
}

export interface ComponentJsDocInfo {
  description: string;
  /** Tag name → one trimmed value per occurrence, in source order. Empty when the symbol has no tags. */
  jsDocTags: Record<string, string[]>;
}

/** Resolve a module export by name, following alias symbols to the declared target. */
export function resolveExportedSymbol<TSourceFile, TSymbol extends JsDocExportSymbolLike>(
  typescript: JsDocHost,
  checker: JsDocExportCheckerLike<TSourceFile, TSymbol>,
  sourceFile: TSourceFile,
  exportName: string
): TSymbol | undefined {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  const symbol = moduleSymbol
    ? checker
        .getExportsOfModule(moduleSymbol)
        .find((candidate) => candidate.getName() === exportName)
    : undefined;

  return symbol && symbol.flags & typescript.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

export function extractComponentJsDocInfo<TChecker>(
  typescript: JsDocHost,
  checker: TChecker,
  symbol: JsDocSymbolLike<TChecker>
): ComponentJsDocInfo {
  const description = typescript.displayPartsToString(symbol.getDocumentationComment(checker));

  const jsDocTags: Record<string, string[]> = {};
  for (const tag of symbol.getJsDocTags(checker)) {
    (jsDocTags[tag.name] ??= []).push(typescript.displayPartsToString(tag.text ?? []).trim());
  }

  return { description, jsDocTags };
}
