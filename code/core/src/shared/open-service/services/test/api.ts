import { registerPublicApi } from '../../../public-api/index.ts';
import { createTestApi, type CreateTestApiOptions } from './definition.ts';

/** Registers the public test API with live addon-vitest dependencies. */
export function registerTestApi(options: CreateTestApiOptions) {
  const testApi = createTestApi(options);
  registerPublicApi([testApi]);
  return testApi;
}
