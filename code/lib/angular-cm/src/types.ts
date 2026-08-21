/**
 * The shape the analyzer emits for every class it records, plus what the analyzer adds on top.
 *
 * The raw shape below stays close to Compodoc's JSON schema, while analyzer-owned fields use the
 * stronger contracts its successor pipeline needs. This package owns these types outright.
 */
import type { ComponentJsDocInfo } from 'storybook/internal/component-meta';

type Html = string;

export interface Decorator {
  name: string;
}

export interface JsDocTag {
  comment?: Html;
  tagName?: {
    escapedText?: string;
  };
}

export interface Argument {
  name: string;
  type: string;
  optional?: boolean;
}

export interface Method {
  name: string;
  args: Argument[];
  returnType: string;
  decorators?: Decorator[];
  /** TypeScript accessibility, omitted for a public member. */
  visibility?: 'private' | 'protected';
  /** Whether the member carries a JSDoc `internal` tag. */
  internal?: boolean;
  description?: Html;
  rawdescription?: string;
  jsdoctags?: JsDocTag[];
}

export type PropertyInitializer =
  | {
      kind: 'literal';
      literalKind:
        | 'string'
        | 'number'
        | 'boolean'
        | 'null'
        | 'undefined'
        | 'bigint'
        | 'enum'
        | 'composite';
      text: string;
    }
  | { kind: 'expression'; text: string };

export interface Property {
  name: string;
  decorators?: Decorator[];
  /** TypeScript accessibility, omitted for a public member. */
  visibility?: 'private' | 'protected';
  /** Whether the member carries a JSDoc `internal` tag. */
  internal?: boolean;
  /** Omitted for members the analyzer cannot type, e.g. `@HostBinding`. */
  type?: string;
  /** Omitted for `@Input()` properties, emitted for the rest. */
  optional?: boolean;
  /** Present for signal inputs and `@Input({ required })`, absent for a plain `@Input()`. */
  required?: boolean;
  /** Syntax-classified source initializer; expressions are metadata, not display defaults. */
  initializer?: PropertyInitializer;
  /** 1-based line the member is declared on. */
  line?: number;
  description?: Html;
  rawdescription?: string;
  jsdoctags?: JsDocTag[];
}

export interface Class {
  name: string;
  type: 'class';
  file?: string;
  properties: Property[];
  methods: Method[];
  description?: Html;
  rawdescription?: string;
}

export interface Injectable {
  name: string;
  type: 'injectable';
  file?: string;
  properties: Property[];
  methods: Method[];
  description?: Html;
  rawdescription?: string;
}

export interface Pipe {
  name: string;
  /** The pipe's Angular name, which is what templates use rather than the class name. */
  ngname: string;
  type: 'pipe';
  file?: string;
  properties: Property[];
  methods: Method[];
  description?: Html;
  rawdescription?: string;
}

export interface Directive {
  name: string;
  type: 'directive' | 'component';
  file?: string;
  propertiesClass: Property[];
  inputsClass: Property[];
  outputsClass: Property[];
  methodsClass: Method[];
  description?: Html;
  rawdescription?: string;
}

export interface TypeAlias {
  name: string;
  ctype: string;
  subtype: string;
  rawtype: string;
  file: string;
  kind: number;
  description?: Html;
  rawdescription?: string;
}

export interface EnumTypeChild {
  name: string;
  /** Numeric for a numeric initializer, keeping a `0` member falsy for the extractor. */
  value?: string | number;
}

export interface EnumType {
  name: string;
  childs: EnumTypeChild[];
  ctype: string;
  subtype: string;
  file: string;
  description?: Html;
  rawdescription?: string;
}

export interface MetadataJson {
  directives?: Directive[];
  components?: Directive[];
  pipes?: Pipe[];
  injectables?: Injectable[];
  classes?: Class[];
  miscellaneous?: {
    typealiases?: TypeAlias[];
    enumerations?: EnumType[];
  };
}

/** What the analyzer adds to every record it produces. */
interface AnalyzerFields {
  /** Absolute path of the defining source file, always spelled with forward slashes. */
  file: string;
  /** Class-level JSDoc tags, carrying plain text rather than rendered HTML. */
  jsdoctags?: JsDocTag[];
  /** The `@Component`/`@Directive` decorator's `selector`, when statically resolvable. */
  selector?: string;
  /** The decorator's `standalone` value, when statically resolvable to a boolean. */
  standalone?: boolean;
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
  json: MetadataJson;
  /** Omitted when extraction reaches analyzer metadata without a class symbol. */
  jsDocInfo?: ComponentJsDocInfo;
}
