import type {
  Class,
  CompodocJson,
  Directive,
  EnumType,
  Injectable,
  JsDocTag,
  Pipe,
  TypeAlias,
} from '@storybook/angular-compodoc';

export type AngularClassMeta = (Class | Directive | Injectable | Pipe) & {
  /** Absolute path of the defining source file, always spelled with forward slashes. */
  file: string;
  /** Class-level JSDoc tags, carrying plain-text comments rather than compodoc's HTML. */
  jsdoctags?: JsDocTag[];
  /** The `@Component`/`@Directive` decorator's `selector`, when statically resolvable. */
  selector?: string;
};

export interface AngularFileMeta {
  components: AngularClassMeta[];
  directives: AngularClassMeta[];
  pipes: AngularClassMeta[];
  injectables: AngularClassMeta[];
  classes: AngularClassMeta[];
  miscellaneous: { typealiases: TypeAlias[]; enumerations: EnumType[] };
}

export interface AngularComponentMetaResult {
  /** The class record the requested export/local name resolved to. */
  entry: AngularClassMeta;
  /** Feed for extractArgTypesFromData's compodocJson option (alias/enum resolution). */
  json: CompodocJson;
}
