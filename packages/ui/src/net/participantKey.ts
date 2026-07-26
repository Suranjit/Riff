/**
 * Resolve the viewer's participant key from a URL query string (`?me=<key>`),
 * generating a fresh one when absent so a standalone board is its own
 * participant. Pure: the query string and generator are passed in.
 */
export function resolveParticipantKey(_search: string, _generate: () => string): string {
  // TODO(#13): implement.
  throw new Error('resolveParticipantKey is not implemented yet (#13)');
}
