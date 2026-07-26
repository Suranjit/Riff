#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { Command } from 'commander';
import { startSession } from './startSession.js';
import { formatStartupBanner } from './formatStartupBanner.js';

/** Locate the built board assets shipped by @riff/ui. */
function resolveBoardDir(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require.resolve('@riff/ui/package.json');
    const dist = join(dirname(pkg), 'dist');
    return existsSync(join(dist, 'index.html')) ? dist : undefined;
  } catch {
    return undefined;
  }
}

const program = new Command();

program
  .name('riff')
  .description('Host a live brainstorming session with coding agents.')
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

    console.log(
      formatStartupBanner({
        url: session.url,
        joinCode: session.joinCode,
        fingerprint: session.fingerprint,
      }),
    );

    const shutdown = () => {
      void session.close().finally(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
