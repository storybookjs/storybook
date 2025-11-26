import os, { type NetworkInterfaceInfoIPv4 } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import { getServerAddresses } from '../server-address';

const mockedNetworkAddress: NetworkInterfaceInfoIPv4 = {
  address: '192.168.0.5',
  netmask: '255.255.255.0',
  family: 'IPv4',
  mac: '01:02:03:0a:0b:0c',
  internal: false,
  cidr: '192.168.0.5/24',
};

vi.mock(
  'node:os',
  async (importOriginal): Promise<typeof os & { default: typeof os }> => ({
    ...(await importOriginal()),
    // We have to mock both the default export and named exports here for whatever reason
    ['default' as never]: {
      networkInterfaces: vi.fn(() => ({
        eth0: [mockedNetworkAddress],
      })),
      release: vi.fn(() => '10.0.26100'),
    },
    networkInterfaces: vi.fn(() => ({
      eth0: [mockedNetworkAddress],
    })),
    release: vi.fn(() => '10.0.26100'),
  })
);
const mockedOs = vi.mocked(os);

describe('getServerAddresses', () => {
  it('builds addresses with a specified host', () => {
    const { address, networkAddress } = getServerAddresses(9009, '192.168.89.89', 'http');
    expect(address).toEqual('http://localhost:9009/');
    expect(networkAddress).toEqual('http://192.168.89.89:9009/');
  });

  it('builds addresses with local IP when host is not specified', () => {
    const { address, networkAddress } = getServerAddresses(9009, '', 'http');
    expect(address).toEqual('http://localhost:9009/');
    expect(networkAddress).toEqual(`http://${mockedNetworkAddress.address}:9009/`);
  });

  it('builds addresses with default address when host is not specified and external IPv4 is not found', () => {
    mockedOs.networkInterfaces.mockReturnValueOnce({
      eth0: [{ ...mockedNetworkAddress, internal: true }],
    });
    const { address, networkAddress } = getServerAddresses(9009, '', 'http');
    expect(address).toEqual('http://localhost:9009/');
    expect(networkAddress).toEqual('http://0.0.0.0:9009/');
  });
});
