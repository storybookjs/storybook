import type { GeneratorModule } from '../types';

export function defineGeneratorModule<T extends GeneratorModule>(generatorModule: T) {
  return generatorModule;
}
