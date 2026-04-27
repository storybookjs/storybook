/**
 * A single import edge extracted from a source file. `specifier` is the literal token the
 * source used (e.g. `./foo`, `lodash`, `@scope/pkg`). `kind` distinguishes the three edge
 * flavours the change-detection walker cares about: static `import`/`export`, dynamic
 * `import()`, and CommonJS `require()`.
 */
export interface ImportEdge {
  specifier: string;
  kind: 'static' | 'dynamic' | 'require';
}

/** Arguments handed to an {@link ImportParser} when the registry dispatches a file to it. */
export interface ParseFileArgs {
  filePath: string;
  source: string;
}

/**
 * Services passed to every parser. SFC parsers (vue, svelte) extract a `<script>` block
 * and then delegate the actual import-edge extraction to the built-in oxc wrapper via
 * {@link ImportParserContext.parseScriptWithOxc}.
 */
export interface ImportParserContext {
  /** Core's oxc-parser wrapper. SFC plugins call this after extracting <script> content. */
  parseScriptWithOxc(source: string, virtualFilePath: string): Promise<ImportEdge[]>;
}

/**
 * A parser plugin that claims one or more file extensions and knows how to extract import
 * edges from that file type. Registered via the `experimental_importParsers` preset key.
 *
 * Extensions are compared with `path.extname(filePath).toLowerCase()` lookup — compound
 * extensions such as `.svelte.ts` are NOT supported here (only the last segment matches).
 */
export interface ImportParser {
  /**
   * Lowercase, leading dot. Compound extensions like `.svelte.ts` are NOT supported here —
   * `path.extname` returns the last segment only, so `.svelte.ts` matches `.ts`.
   */
  extensions: readonly string[];
  parse(args: ParseFileArgs, ctx: ImportParserContext): Promise<ImportEdge[]>;
}
