/**
 * How the registered Claude Code integration launches Riff. Published installs
 * use `npx -y riffboard <sub>`; local development points node at the bundled
 * (or source) CLI directly so the flow works before publishing.
 */
export type Launcher = {
  command: string;
  argsPrefix: string[];
};

/** The default, published launcher: `npx -y riffboard <sub>`. */
export const npxLauncher: Launcher = {
  command: 'npx',
  argsPrefix: ['-y', 'riffboard'],
};

/** A launcher that runs the current CLI directly: `<node> <cliPath> <sub>`. */
export function localLauncher(cliPath: string, execPath: string): Launcher {
  // TODO(#16): implement.
  throw new Error('localLauncher is not implemented yet (#16)');
}

/** The shell command string for a hook subcommand, with an idempotency marker. */
export function hookCommand(launcher: Launcher, sub: string, marker: string): string {
  // TODO(#16): implement.
  throw new Error('hookCommand is not implemented yet (#16)');
}
