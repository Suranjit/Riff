#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { Command } from 'commander';
import { buildJoinLink } from '@riff/shared';
import {
  runMcpServer,
  runHook,
  runAutoPushHook,
  defaultAutoPushFile,
  DEFAULT_AUTOPUSH_INTERVAL_MS,
} from '@riff/mcp';
import { startSession } from './startSession.js';
import { formatStartupBanner } from './formatStartupBanner.js';
import { performJoin } from './join.js';
import { readSessionFile, sessionFilePath } from './sessionFile.js';
import { resolveSessionOptions } from './resolveSession.js';

/** Locate the built board assets (workspace @riff/ui in dev, bundled board/ when published). */
function resolveBoardDir(): string | undefined {
  const require = createRequire(import.meta.url);
  const candidates: string[] = [];
  // Published layout: dist/cli.js next to board/.
  candidates.push(join(dirname(fileURLToPath(import.meta.url)), '..', 'board'));
  try {
    const pkg = require.resolve('@riff/ui/package.json');
    candidates.push(join(dirname(pkg), 'dist'));
  } catch {
    // @riff/ui not resolvable in a published install — fine.
  }
  return candidates.find((dir) => existsSync(join(dir, 'index.html')));
}

const program = new Command();

program
  .name('riff')
  .description('Host and join live brainstorming sessions with coding agents.')
  .version('0.0.0');

program
  .command('start')
  .description('Start a Riff session and serve the board on your network.')
  .option('-p, --port <port>', 'port to bind', (v) => Number.parseInt(v, 10), 4747)
  .option('-h, --host <host>', 'interface to bind', '0.0.0.0')
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
  .action((link: string, options: { name?: string }) => {
    const result = performJoin({ link, name: options.name, homeDir: homedir() });
    const firstTime = result.mcpAdded || result.promptHookAdded || result.stopHookAdded;
    console.log('');
    console.log(`  🎸 Joined as ${result.name}.`);
    console.log(`  → Your board:  ${result.boardUrl}`);
    if (firstTime) {
      console.log('');
      console.log('  Claude Code integration installed. Restart Claude Code once to load it.');
    } else {
      console.log('  Claude Code already set up — you are ready to go.');
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
    const injection = runHook();
    if (injection) process.stdout.write(injection);
  });

program
  .command('autopush')
  .description('(internal) Stop hook: nudge Claude to refresh its capsule.')
  .action(() => {
    const intervalMs = Number(
      process.env.RIFF_AUTOPUSH_INTERVAL_MS ?? DEFAULT_AUTOPUSH_INTERVAL_MS,
    );
    const result = runAutoPushHook(defaultAutoPushFile(), Date.now(), intervalMs);
    if (result.block) {
      process.stdout.write(JSON.stringify({ decision: 'block', reason: result.reason }));
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
