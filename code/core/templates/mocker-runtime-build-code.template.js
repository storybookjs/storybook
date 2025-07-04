import { ModuleMocker, createCompilerHints } from '@vitest/mocker/browser';
import { spyOn } from '@vitest/spy';
import * as moduleMockerBuildInterceptor from 'virtual:module-mocker-build-interceptor';

// Dummy implementation of the RPC interface, since it is not used in build mode.
const rpc = (method) => {
  switch (method) {
    case 'resolveId':
      return Promise.resolve({
        id: '',
        url: '',
        optimized: false,
      });
    case 'resolveMock':
      return Promise.resolve({
        mockType: 'dummy',
        resolvedId: '',
        resolvedUrl: '',
        redirectUrl: '',
        needsInterop: false,
      });
    case 'invalidate':
      return Promise.resolve();
  }
};

// In build mode, we don't need runtime handling of mocks.
// Everything is handled at build time and via the MSW interceptor.
class BuildModuleMocker extends ModuleMocker {
  queueMock() {
    // noop
  }
}

function registerModuleMocker(interceptor) {
  const mocker = new BuildModuleMocker(
    interceptor('__vitest_mocker__'),
    {
      resolveId(id, importer) {
        return rpc('resolveId', { id, importer });
      },
      resolveMock(id, importer, options) {
        return rpc('resolveMock', { id, importer, options });
      },
      async invalidate(ids) {
        return rpc('invalidate', { ids });
      },
    },
    spyOn,
    {
      root: '',
    }
  );

  globalThis['__vitest_mocker__'] = mocker;

  return createCompilerHints({
    globalThisKey: '__vitest_mocker__',
  });
}

globalThis.__STORYBOOK_MOCKER__ = registerModuleMocker(
  (accessor) =>
    new moduleMockerBuildInterceptor.ModuleMockerBuildInterceptor({ globalThisAccessor: accessor })
);
