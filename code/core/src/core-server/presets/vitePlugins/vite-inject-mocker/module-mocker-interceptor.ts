import type { MockedModule } from '@vitest/mocker';
import { MockerRegistry } from '@vitest/mocker';

/** An interceptor for module mocking. */
export class ModuleMockerInterceptor {
  // A registry for runtime mocks (e.g., `sb.mock('path', () => ({}))`)
  private mocks = new MockerRegistry();

  constructor() {}

  /**
   * Called by ModuleMocker when `sb.mock()` is executed. We just store the mock in our registry.
   * The dynamic MSW handler will pick it up on the next relevant network request. Currently, we
   * don't use this.mocks in any way. Mocks will be registered in the user's preview file and live
   * until the end. There is no way to invalidate or delete them.
   */
  public async register(module: MockedModule): Promise<void> {
    this.mocks.add(module);
  }

  public async delete(url: string): Promise<void> {
    this.mocks.delete(url);
  }

  public async invalidate(): Promise<void> {
    this.mocks.clear();
  }
}
