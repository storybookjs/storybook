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
} from './compodoc-types.ts';

/** What the analyzer adds to every record it produces. */
interface AnalyzerFields {
  /** Absolute path of the defining source file, always spelled with forward slashes. */
  file: string;
  /** Class-level JSDoc tags, carrying plain text rather than rendered HTML. */
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
 * Structurally the shape the argTypes extractor reads, which is what lets it resolve aliases and
 * enums against this without a cast.
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
  /** Every class in the file, for the extractor's alias and enum resolution. */
  json: CompodocJson;
}
