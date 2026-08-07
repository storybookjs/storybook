/**
 * Compodoc renders doc comments through Markdown, so the value is an HTML fragment rather than the
 * text that was written. Unwrap it before displaying it. Each field's `raw` counterpart carries the
 * original comment.
 */
type Html = string;

export interface Method {
  name: string;
  args: Argument[];
  returnType: string;
  decorators?: Decorator[];
  description?: Html;
  rawdescription?: string;
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
  /**
   * Whether the member is TS-optional. Compodoc omits it entirely for `@Input()`-decorated
   * properties while emitting it for signal inputs and plain class properties (compodoc#863, still
   * open at 2.0.0), so it is absent far more often than the old non-optional declaration implied.
   */
  optional?: boolean;
  /**
   * Compodoc's own requiredness flag, which is what Angular actually means by a required input.
   * Present for signal inputs and for `@Input({ required })`; absent for a plain `@Input()`.
   */
  required?: boolean;
  defaultValue?: string;
  /**
   * 1-based line the member is declared on. Compodoc emits it for every member, but a hand-written
   * or truncated capture may not.
   */
  line?: number;
  description?: Html;
  rawdescription?: string;
  jsdoctags?: JsDocTag[];
}

export interface Class {
  name: string;
  type: 'class';
  /**
   * Source file the entry was declared in. Compodoc records it on every entry even though its own
   * published types omit it, and it is what disambiguates same-named declarations.
   */
  file?: string;
  properties: Property[];
  methods: Method[];
  description?: Html;
  rawdescription?: string;
}

export interface Injectable {
  name: string;
  type: 'injectable';
  /**
   * Source file the entry was declared in. Compodoc records it on every entry even though its own
   * published types omit it, and it is what disambiguates same-named declarations.
   */
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
  /**
   * Source file the entry was declared in. Compodoc records it on every entry even though its own
   * published types omit it, and it is what disambiguates same-named declarations.
   */
  file?: string;
  properties: Property[];
  methods: Method[];
  description?: Html;
  rawdescription?: string;
}

export interface Directive {
  name: string;
  type: 'directive' | 'component';
  /**
   * Source file the entry was declared in. Compodoc records it on every entry even though its own
   * published types omit it, and it is what disambiguates same-named declarations.
   */
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
  value?: string;
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
