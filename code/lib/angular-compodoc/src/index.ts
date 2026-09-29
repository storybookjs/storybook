export type {
  Argument,
  Class,
  CompodocJson,
  Component,
  Decorator,
  Directive,
  EnumType,
  EnumTypeChild,
  Injectable,
  JsDocTag,
  Method,
  Pipe,
  Property,
  TypeAlias,
} from './compodoc-types.ts';
export type {
  CompodocEntry,
  CompodocLookupOptions,
  CompodocParsingLogger,
  ExtractArgTypesOptions,
} from './extract-arg-types.ts';
export {
  checkValidCompodocJson,
  checkValidComponentOrDirective,
  extractArgTypesFromData,
  extractType,
  findComponentByName,
  getComponentData,
  isMethod,
  unwrapPlainText,
} from './extract-arg-types.ts';
export { htmlToText } from './html-to-text.ts';
