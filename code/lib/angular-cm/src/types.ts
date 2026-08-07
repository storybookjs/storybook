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

/** One analyzed class record, with the extra fields the docgen worker reads. */
export type AngularClassMeta = (Class | Directive | Injectable | Pipe) & {
  /** Absolute path of the defining source file (forward slashes). */
  file: string;
  /** Class-level JSDoc tags (plain-text comments, not HTML). */
  jsdoctags?: JsDocTag[];
  /**
   * The `@Component`/`@Directive` decorator's `selector`, when statically resolvable. Snippet
   * generation turns it into the element a story template renders.
   */
  selector?: string;
};

/** Everything extracted from one source file (plus cross-file misc referenced by types). */
export interface AngularFileMeta {
  components: AngularClassMeta[];
  directives: AngularClassMeta[];
  pipes: AngularClassMeta[];
  injectables: AngularClassMeta[];
  classes: AngularClassMeta[];
  miscellaneous: { typealiases: TypeAlias[]; enumerations: EnumType[] };
}

/** What {@link AngularComponentMetaManager.extractComponentMeta} returns for one component. */
export interface AngularComponentMetaResult {
  /** The class record the requested export/local name resolved to. */
  entry: AngularClassMeta;
  /** Feed for extractArgTypesFromData's compodocJson option (alias/enum resolution). */
  json: CompodocJson;
}
