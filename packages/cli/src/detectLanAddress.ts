import type { NetworkInterfaceInfo } from 'node:os';

/**
 * Pick the first non-internal IPv4 address from an `os.networkInterfaces()`
 * map, so participants can reach the host on the LAN. Falls back to `localhost`.
 * Pure: the interfaces map is passed in.
 */
export function detectLanAddress(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): string {
  for (const infos of Object.values(interfaces)) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  return 'localhost';
}
