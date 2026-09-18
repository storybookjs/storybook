import type { GeneratorModule } from '../types.ts';

export function defineGeneratorModule<T extends GeneratorModule>(generatorModule: T) {
  return generatorModule;
}
