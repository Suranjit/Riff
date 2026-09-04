/**
 * What to tell someone after they click Riff.
 *
 * The wording is deliberately precise about *when* the context arrives. Nothing
 * is prepended at click time: the capsule is staged, and the Claude Code hook
 * injects it before the next message you send. Claiming it had already been
 * applied would send people looking for something that is not there yet.
 */
export function riffNoticeFor(opts: {
  author: string;
  /** Whether the request actually left the browser. */
  sent: boolean;
  /** Whether this person's own Claude Code is connected to the session. */
  agentConnected: boolean;
}): string {
  if (!opts.sent) {
    return 'Not connected to the board — reconnecting. Try that riff again in a moment.';
  }
  if (!opts.agentConnected) {
    return 'No Claude Code connected for you — paste the “Connect Claude Code” command, then riff again.';
  }
  return `Copied ${opts.author}'s context — it will be used in your next Claude Code message.`;
}
