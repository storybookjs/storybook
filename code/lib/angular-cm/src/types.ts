import type {
  Class,
  CompodocJson,
  Directive,
  EnumType,
  Injectable,
  JsDocTag,
  Pipe,
  Property,
  TypeAlias,
} from '@storybook/angular-compodoc';

/** What the analyzer adds to every compodoc record it produces. */
interface AnalyzerFields {
  /** Absolute path of the defining source file, always spelled with forward slashes. */
  file: string;
  /** Class-level JSDoc tags, carrying plain-text comments rather than compodoc's HTML. */
  jsdoctags?: JsDocTag[];
  /** The `@Component`/`@Directive` decorator's `selector`, when statically resolvable. */
  selector?: string;
}

export type AngularDirectiveMeta = Directive & AnalyzerFields;
export type AngularPipeMeta = Pipe & AnalyzerFields;
export type AngularInjectableMeta = Injectable & AnalyzerFields;
/** A plain class keeps its IO split out too; the extractor ignores the extra arrays. */
export type AngularPlainClassMeta = Class &
  AnalyzerFields & { inputsClass?: Property[]; outputsClass?: Property[] };

export type AngularClassMeta =
  | AngularDirectiveMeta
  | AngularPipeMeta
  | AngularInjectableMeta
  | AngularPlainClassMeta;

/**
 * Every class in one source file, bucketed by kind.
 *
 * Structurally a {@link CompodocJson}, which is what lets the extractor resolve aliases and enums
 * against it without a cast.
 */
export interface AngularFileMeta {
  components: AngularDirectiveMeta[];
  directives: AngularDirectiveMeta[];
  pipes: AngularPipeMeta[];
  injectables: AngularInjectableMeta[];
  classes: AngularPlainClassMeta[];
  miscellaneous: { typealiases: TypeAlias[]; enumerations: EnumType[] };
}

export interface AngularComponentMetaResult {
  /** The class record the requested export/local name resolved to. */
  entry: AngularClassMeta;
  /** Feed for extractArgTypesFromData's compodocJson option (alias/enum resolution). */
  json: CompodocJson;
}
