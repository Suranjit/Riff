import { describe, expect, it } from 'vitest';
import type { NetworkInterfaceInfo } from 'node:os';
import { detectLanAddress } from './detectLanAddress.js';

const ipv4 = (address: string, internal: boolean): NetworkInterfaceInfo =>
  ({ address, internal, family: 'IPv4', netmask: '', mac: '', cidr: null }) as NetworkInterfaceInfo;

describe('detectLanAddress', () => {
  it('returns the first non-internal IPv4 address', () => {
    const interfaces = {
      lo: [ipv4('127.0.0.1', true)],
      en0: [ipv4('192.168.1.20', false)],
    };
    expect(detectLanAddress(interfaces)).toBe('192.168.1.20');
  });

  it('ignores internal addresses', () => {
    const interfaces = {
      lo: [ipv4('127.0.0.1', true)],
      en0: [ipv4('10.0.0.5', false)],
    };
    expect(detectLanAddress(interfaces)).toBe('10.0.0.5');
  });

  it('falls back to localhost when only internal addresses exist', () => {
    const interfaces = { lo: [ipv4('127.0.0.1', true)] };
    expect(detectLanAddress(interfaces)).toBe('localhost');
  });

  it('falls back to localhost when there are no interfaces', () => {
    expect(detectLanAddress({})).toBe('localhost');
  });
});
