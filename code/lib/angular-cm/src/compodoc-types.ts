/**
 * The shape the analyzer emits for every class it records.
 *
 * This mirrors Compodoc's own JSON schema on purpose: the docgen worker feeds analyzer output
 * through the same argTypes extractor Compodoc-based docgen uses, so the two must stay
 * structurally interchangeable even though this package no longer depends on Compodoc.
 */
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
  description?: Html;
  rawdescription?: string;
  jsdoctags?: JsDocTag[];
}

export interface Property {
  name: string;
  decorators?: Decorator[];
  /** Omitted for members the analyzer cannot type, e.g. `@HostBinding`. */
  type?: string;
  /** Omitted for `@Input()` properties, emitted for the rest. */
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

export interface CompodocJson {
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
