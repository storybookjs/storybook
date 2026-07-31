export interface Method {
  name: string;
  args: Argument[];
  returnType: string;
  decorators?: Decorator[];
  description?: string;
  rawdescription?: string;
}

export interface JsDocTag {
  comment?: string;
  tagName?: {
    escapedText?: string;
  };
}

export interface Property {
  name: string;
  /** Original property name when a signal alias or `@Input('alias')` overrides `name`. */
  actualName?: string;
  decorators?: Decorator[];
  type: string;
  optional: boolean;
  /** `true` for `input.required<T>()` or `@Input({ required: true })` signals. */
  required?: boolean;
  defaultValue?: string;
  description?: string;
  rawdescription?: string;
  jsdoctags?: JsDocTag[];
}

export interface HostBinding {
  name: string;
  type?: string;
  description?: string;
  rawdescription?: string;
}

export interface HostListener {
  name: string;
  args?: Argument[];
  description?: string;
  rawdescription?: string;
}

export interface TemplateVariable {
  name: string;
  defaultValue: string;
}

export interface Class {
  name: string;
  ngname: string;
  type: 'pipe';
  properties: Property[];
  methods: Method[];
  description?: string;
  rawdescription?: string;
}

export interface Injectable {
  name: string;
  type: 'injectable';
  /** Injectable scope, e.g. `"root"` or `"platform"`. New in Compodoc 2.0. */
  providedIn?: string;
  properties: Property[];
  methods: Method[];
  description?: string;
  rawdescription?: string;
}

export interface Pipe {
  name: string;
  type: 'class';
  /** `true` for standalone pipes. New in Compodoc 2.0. */
  standalone?: boolean;
  properties: Property[];
  methods: Method[];
  description?: string;
  rawdescription?: string;
}

export interface Directive {
  name: string;
  type: 'directive' | 'component';
  /** Raw Angular CSS selector, e.g. `"button[lib-btn], a[lib-btn]"`. */
  selector?: string;
  /** `true` for standalone components/directives. New in Compodoc 2.0. */
  standalone?: boolean;
  /** Change detection strategy, e.g. `"ChangeDetectionStrategy.OnPush"`. */
  changeDetection?: string;
  /** Inline template source. */
  template?: string;
  /** Resolved template URL(s). */
  templateUrl?: string[];
  /** `@let` variables declared in the template. New in Compodoc 2.0 (Angular 18+). */
  templateVariables?: TemplateVariable[];
  /** Style URLs, merging both `styleUrls` and `styleUrl` (singular, new in Compodoc 2.0). */
  styleUrls?: string[];
  /** Host directives applied via `hostDirectives`. */
  hostDirectives?: Array<{
    name: string;
    inputs?: string[];
    outputs?: string[];
  }>;
  /** Host bindings from `@HostBinding` decorators. */
  hostBindings?: HostBinding[];
  /** Host listeners from `@HostListener` decorators. */
  hostListeners?: HostListener[];
  propertiesClass: Property[];
  inputsClass: Property[];
  outputsClass: Property[];
  methodsClass: Method[];
  description?: string;
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
  description?: string;
  rawdescription?: string;
}

export interface EnumType {
  name: string;
  childs: EnumTypeChild[];
  ctype: string;
  subtype: string;
  file: string;
  description?: string;
  rawdescription?: string;
}

export interface EnumTypeChild {
  name: string;
  value?: string;
}

export interface CompodocJson {
  directives: Directive[];
  components: Component[];
  pipes: Pipe[];
  injectables: Injectable[];
  classes: Class[];
  miscellaneous?: {
    typealiases?: TypeAlias[];
    enumerations?: EnumType[];
  };
}
