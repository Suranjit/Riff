#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { Command, InvalidArgumentError } from 'commander';
import { buildJoinLink } from '@riff/shared';
import { runMcpServer, runHook, defaultStateFile } from '@riff/mcp';
import { startSession } from './startSession.js';
import { formatStartupBanner } from './formatStartupBanner.js';
import { performJoin } from './join.js';
import { localLauncher } from './launcher.js';
import { readSessionFile, sessionFilePath } from './sessionFile.js';
import { resolveSessionOptions } from './resolveSession.js';

/** Locate the built board assets (workspace @riff/ui in dev, bundled board/ when published). */
function resolveBoardDir(): string | undefined {
  const require = createRequire(import.meta.url);
  const candidates: string[] = [];
  // Dev: prefer the freshly built workspace board over the copied snapshot,
  // which otherwise serves a stale UI until `copy-board` runs again.
  try {
    const pkg = require.resolve('@riff/ui/package.json');
    candidates.push(join(dirname(pkg), 'dist'));
  } catch {
    // @riff/ui not resolvable in a published install — fine.
  }
  // Published layout: dist/cli.js next to board/.
  candidates.push(join(dirname(fileURLToPath(import.meta.url)), '..', 'board'));
  return candidates.find((dir) => existsSync(join(dir, 'index.html')));
}

/** The package's real version, so `riff --version` and bug reports stay accurate. */
function packageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    // Same relative location in both layouts: dist/cli.js and src/cli.ts.
    const pkg = require('../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Parse and validate a --port value; commander turns a thrown error into a clean exit. */
function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new InvalidArgumentError('Port must be an integer between 0 and 65535.');
  }
  return port;
}

const program = new Command();

program
  .name('riff')
  .description('Host and join live brainstorming sessions with coding agents.')
  .version(packageVersion());

program
  .command('start')
  .description('Start a Riff session and serve the board on your network.')
  .option('-p, --port <port>', 'port to bind', parsePort, 4747)
  // No -h short flag: it would shadow commander's built-in -h/--help.
  .option('--host <host>', 'interface to bind', '0.0.0.0')
  .option('--demo', 'seed sample capsules so the board is not empty', false)
  .action(async (options: { port: number; host: string; demo: boolean }) => {
    const staticDir = resolveBoardDir();
    if (!staticDir) {
      console.error(
        'Could not find the built board. Run `pnpm build` first (packages/ui must be built).',
      );
      process.exitCode = 1;
      return;
    }

    const session = await startSession({
      port: options.port,
      host: options.host,
      demo: options.demo,
      staticDir,
    });

    const joinLink = buildJoinLink({
      baseUrl: new URL(session.url).origin,
      sessionId: session.sessionId,
      joinCode: session.joinCode,
      fingerprint: session.fingerprint,
    });

    console.log(
      formatStartupBanner({
        url: session.url,
        joinCode: session.joinCode,
        fingerprint: session.fingerprint,
        joinCommand: `npx riffboard join "${joinLink}"`,
      }),
    );

    const shutdown = () => {
      void session.close().finally(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program
  .command('join <link>')
  .description('Connect Claude Code to a Riff session (one-time setup, then paste per session).')
  .option('-n, --name <name>', 'your display name on the board')
  .option('--local', 'register this local build instead of npx (for testing before publishing)')
  .action((link: string, options: { name?: string; local?: boolean }) => {
    const launcher = options.local
      ? localLauncher(fileURLToPath(import.meta.url), process.execPath)
      : undefined;
    const result = performJoin({ link, name: options.name, homeDir: homedir(), launcher });
    const firstTime = result.mcpAdded || result.promptHookAdded;
    console.log('');
    console.log(`  🎸 Joined as ${result.name}.`);
    console.log(`  → Your board:  ${result.boardUrl}`);
    if (options.local) {
      console.log('  → Local mode: Claude Code will launch this build directly.');
    }
    if (firstTime) {
      console.log('');
      console.log('  Claude Code integration installed. Restart Claude Code once to load it.');
    } else {
      console.log('  Claude Code integration updated.');
    }
    console.log('');
  });

/** Shared resolver for the static subcommands. */
function loadSession() {
  const file = readSessionFile(sessionFilePath(homedir()));
  const resolved = resolveSessionOptions(process.env, file);
  if (!resolved) {
    console.error('No Riff session configured. Run `riff join "<link>"` first.');
    process.exit(1);
  }
  return resolved;
}

program
  .command('mcp')
  .description('(internal) Run the Riff MCP server for Claude Code.')
  .action(async () => {
    const s = loadSession();
    await runMcpServer({
      baseUrl: s.baseUrl,
      sessionId: s.sessionId,
      joinCode: s.joinCode,
      name: s.name,
      participantKey: s.participantKey,
      fingerprint: s.fingerprint,
      insecure: process.env.RIFF_INSECURE === '1',
    });
  });

program
  .command('hook')
  .description('(internal) UserPromptSubmit hook: inject a queued riff.')
  .action(() => {
    // Derive the same per-identity path the plugin writes to.
    const session = readSessionFile(sessionFilePath(homedir()));
    const injection = runHook(defaultStateFile(session?.sessionId, session?.participantKey));
    if (injection) process.stdout.write(injection);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
