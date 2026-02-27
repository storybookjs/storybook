import { fn } from 'storybook/test';

type ServerFnStub = ReturnType<typeof fn>;

type StubEntry = {
  stub: ServerFnStub;
  name?: string;
};

const serverFnRegistry = new Set<StubEntry>();

const applyDefaultImplementation = (stub: ServerFnStub, name?: string) => {
  stub.mockImplementation(() => {
    const label = name ? `"${name}"` : 'a server function';
    console.warn(`[@storybook/tanstack-react] ${label} was called without a mock implementation.`);
    return undefined;
  });
};

export const createServerFnStub = (name?: string) => {
  const stub = fn();
  serverFnRegistry.add({ stub, name });
  applyDefaultImplementation(stub, name);
  return stub;
};

export const resetAllServerFnStubs = () => {
  serverFnRegistry.forEach(({ stub, name }) => {
    stub.mockReset();
    applyDefaultImplementation(stub, name);
  });
};
