import { describe, beforeEach, it, expect, vi } from 'vitest';
import os, { type NetworkInterfaceInfoIPv4 } from 'os';
import { getServerAddresses } from '../server-address';

vi.mock('os');
const mockedOs = vi.mocked(os);

describe('getServerAddresses', () => {
  const mockedNetworkAddress: NetworkInterfaceInfoIPv4 = {
    address: '192.168.0.5',
    netmask: '255.255.255.0',
    family: 'IPv4',
    mac: '01:02:03:0a:0b:0c',
    internal: false,
    cidr: '192.168.0.5/24',
  };

  beforeEach(() => {
    mockedOs.networkInterfaces.mockReturnValue({
      eth0: [mockedNetworkAddress],
    });
  });

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
