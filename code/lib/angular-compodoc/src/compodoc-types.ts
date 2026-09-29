// Compodoc renders doc comments through Markdown; each field's `raw` counterpart has the original.
type Html = string;

export interface Method {
  name: string;
  args: Argument[];
  returnType: string;
  decorators?: Decorator[];
  description?: Html;
  rawdescription?: string;
  jsdoctags?: JsDocTag[];
}

export interface JsDocTag {
  comment?: Html;
  tagName?: {
    escapedText?: string;
  };
}

export interface Property {
  name: string;
  decorators?: Decorator[];
  /** Omitted by Compodoc for members it cannot type, e.g. `@HostBinding`. */
  type?: string;
  /** Omitted by Compodoc for `@Input()` properties, emitted for the rest (compodoc#863). */
  optional?: boolean;
  /** Present for signal inputs and `@Input({ required })`, absent for a plain `@Input()`. */
  required?: boolean;
  defaultValue?: string;
  /** 1-based line the member is declared on. */
  line?: number;
  description?: Html;
  rawdescription?: string;
  jsdoctags?: JsDocTag[];
}

export interface Class {
  name: string;
  type: 'class';
  /** Declaring source file, which Compodoc emits despite omitting it from its published types. */
  file?: string;
  properties: Property[];
  methods: Method[];
  description?: Html;
  rawdescription?: string;
}

export interface Injectable {
  name: string;
  type: 'injectable';
  /** Declaring source file, which Compodoc emits despite omitting it from its published types. */
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
  /** Declaring source file, which Compodoc emits despite omitting it from its published types. */
  file?: string;
  properties: Property[];
  methods: Method[];
  description?: Html;
  rawdescription?: string;
}

export interface Directive {
  name: string;
  type: 'directive' | 'component';
  /** Declaring source file, which Compodoc emits despite omitting it from its published types. */
  file?: string;
  propertiesClass: Property[];
  inputsClass: Property[];
  outputsClass: Property[];
  methodsClass: Method[];
  description?: Html;
  rawdescription?: string;
}

export type Component = Directive;

export interface Argument {
  name: string;
  type: string;
  optional?: boolean;
}

export interface Decorator {
  name: string;
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

export interface EnumType {
  name: string;
  childs: EnumTypeChild[];
  ctype: string;
  subtype: string;
  file: string;
  description?: Html;
  rawdescription?: string;
}

export interface EnumTypeChild {
  name: string;
  /** Numeric for a numeric initializer, keeping a `0` member falsy for the extractor. */
  value?: string | number;
}

/**
 * Every array is optional: Compodoc omits the ones a project has no entries for, and a hand-written
 * or truncated `documentation.json` may omit more.
 */
export interface CompodocJson {
  directives?: Directive[];
  components?: Component[];
  pipes?: Pipe[];
  injectables?: Injectable[];
  classes?: Class[];
  miscellaneous?: {
    typealiases?: TypeAlias[];
    enumerations?: EnumType[];
  };
}
