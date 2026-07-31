import type {
  Class,
  CompodocJson,
  Component,
  Directive,
  Injectable,
  Pipe,
} from './compodocTypes.ts';

export const findComponentByName = (name: string, compodocJson: CompodocJson) =>
  compodocJson.components.find((c: Component) => c.name === name) ||
  compodocJson.directives.find((c: Directive) => c.name === name) ||
  compodocJson.pipes.find((c: Pipe) => c.name === name) ||
  compodocJson.injectables.find((c: Injectable) => c.name === name) ||
  compodocJson.classes.find((c: Class) => c.name === name);
