import { join } from 'node:path';

import { JsonReporter } from 'vitest/reporters';

export default class StorybookReporter extends JsonReporter {
  constructor({ configDir = '.storybook' }: { configDir: string }) {
    const outputFile = join(configDir, 'test-results.json');
    super({
      outputFile,
    });
  }
}
