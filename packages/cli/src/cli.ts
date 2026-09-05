#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { Command, InvalidArgumentError } from 'commander';
import { buildJoinLink } from '@riff/shared';
import { runMcpServer, runHook, defaultStateFile } from '@riff/mcp';
import { startSession } from './startSession.js';
import { formatStartupBanner } from './formatStartupBanner.js';
import { performJoin } from './join.js';
import { localLauncher } from './launcher.js';
import { readSessionFile, sessionFilePath } from './sessionFile.js';
import { resolveSessionOptions } from './resolveSession.js';
import { planPostJoin } from './postJoin.js';

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

    let session;
    try {
      session = await startSession({
        port: options.port,
        host: options.host,
        demo: options.demo,
        staticDir,
      });
    } catch (err) {
      // A port clash is the common case, and the raw EADDRINUSE gives no hint
      // that the likely cause is a Riff session you already have running —
      // whose join code will differ from whatever banner you are reading.
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        console.error(
          `\n  Port ${options.port} is already in use.\n\n` +
            '  Another Riff session is probably still running. Note that each session\n' +
            '  has its own join code, so a stale host will reject the code you were\n' +
            "  given by a newer one — that shows up in the browser as 'Check your join code'.\n\n" +
            '  Either stop the other session (Ctrl-C in its terminal), or start this\n' +
            `  one elsewhere:  riff start --port ${options.port + 1}\n`,
        );
      } else {
        console.error(`\n  Could not start Riff: ${(err as Error).message}\n`);
      }
      process.exitCode = 1;
      return;
    }

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
  .option('--no-launch', 'configure only; do not start Claude Code afterwards')
  .action((link: string, options: { name?: string; local?: boolean; launch?: boolean }) => {
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
    console.log(
      firstTime ? '  Claude Code integration installed.' : '  Claude Code integration updated.',
    );
    console.log('');

    // Claude Code reads this config at startup, so starting it here is what
    // makes the new MCP server and hook take effect.
    const plan = planPostJoin({
      hasClaude: spawnSync('which', ['claude']).status === 0,
      isInteractive: process.stdout.isTTY === true,
      noLaunch: options.launch === false,
    });

    if (plan.action === 'install-claude') {
      console.log('  Claude Code is not installed — get it at ' + plan.url);
      console.log('  Then run `claude` here and your agent will join the board.');
      console.log('');
      return;
    }
    if (plan.action === 'manual') {
      console.log('  Start (or restart) Claude Code to load it.');
      console.log('');
      return;
    }

    console.log('  Starting Claude Code…');
    console.log('');
    const child = spawn('claude', [], { stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code ?? 0));
    child.on('error', () => {
      console.error('  Could not start Claude Code. Run `claude` here yourself.');
      process.exitCode = 1;
    });
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
    // Derive the same per-identity path the plugin writes to. With no session
    // configured there is nothing to inject — stay silent rather than guess a
    // path and read someone else's file.
    const session = readSessionFile(sessionFilePath(homedir()));
    if (!session?.sessionId || !session.participantKey) return;
    const injection = runHook(defaultStateFile(session.sessionId, session.participantKey));
    if (injection) process.stdout.write(injection);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
