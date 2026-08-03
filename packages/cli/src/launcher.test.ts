import { describe, expect, it } from 'vitest';
import { hookCommand, localLauncher, npxLauncher } from './launcher.js';

describe('npxLauncher', () => {
  it('runs npx -y riffboard', () => {
    expect(npxLauncher).toEqual({ command: 'npx', argsPrefix: ['-y', 'riffboard'] });
  });
});

describe('localLauncher', () => {
  it('runs the node exec path against the cli entry', () => {
    const launcher = localLauncher('/abs/dist/cli.js', '/usr/bin/node');
    expect(launcher).toEqual({ command: '/usr/bin/node', argsPrefix: ['/abs/dist/cli.js'] });
  });
});

describe('hookCommand', () => {
  it('joins the launcher and subcommand and appends the marker', () => {
    const cmd = hookCommand(npxLauncher, 'hook', '#riff-hook');
    expect(cmd).toBe('npx -y riffboard hook #riff-hook');
  });

  it('quotes local paths so spaces survive', () => {
    const cmd = hookCommand(localLauncher('/a b/cli.js', '/usr/bin/node'), 'hook', '#riff-hook');
    expect(cmd).toContain('#riff-hook');
    expect(cmd).toContain('hook');
    expect(cmd).toContain('/a b/cli.js');
  });
});
