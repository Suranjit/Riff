import type { NetworkInterfaceInfo } from 'node:os';

/**
 * Pick the first non-internal IPv4 address from an `os.networkInterfaces()`
 * map, so participants can reach the host on the LAN. Falls back to `localhost`.
 * Pure: the interfaces map is passed in.
 */
export function detectLanAddress(
  _interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>,
): string {
  // TODO(#12): implement.
  throw new Error('detectLanAddress is not implemented yet (#12)');
}
