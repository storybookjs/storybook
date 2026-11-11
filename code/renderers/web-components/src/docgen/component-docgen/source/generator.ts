import { logger } from 'storybook/internal/node-logger';

import type { ManifestPackage } from '../manifest/types.ts';

export interface GeneratorAdapter {
  generate(tsConfigPath: string, files: string[]): ManifestPackage;
}

let loadPromise: Promise<GeneratorAdapter> | undefined;

export async function loadGenerator(): Promise<GeneratorAdapter> {
  loadPromise ??= loadGeneratorModule();
  return loadPromise;
}

async function loadGeneratorModule(): Promise<GeneratorAdapter> {
  const [generator, lit] = await Promise.all([
    import('@wc-toolkit/cem-generator'),
    import('@wc-toolkit/cem-generator-lit'),
  ]);

  return {
    generate: (tsConfigPath, files): ManifestPackage =>
      generator.generateCem({
        tsConfigPath,
        include: files,
        plugins: [lit.litPlugin()],
        validation: {
          invariants: 'warning',
          onWarning: (message: string) => logger.debug(message),
        },
        modulePathResolver: { skip: true },
      }),
  };
}
