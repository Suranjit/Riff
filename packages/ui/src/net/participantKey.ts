/**
 * Resolve the viewer's participant key from a URL query string (`?me=<key>`),
 * generating a fresh one when absent so a standalone board is its own
 * participant. Pure: the query string and generator are passed in.
 */
export function resolveParticipantKey(search: string, generate: () => string): string {
  const me = new URLSearchParams(search).get('me');
  return me && me.length > 0 ? me : generate();
}
