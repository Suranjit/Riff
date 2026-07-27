import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureClaudeConfig } from './claudeConfig.js';
import { localLauncher } from './launcher.js';

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('ensureClaudeConfig', () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'riff-claude-'));
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('registers the MCP server and both hooks in a fresh home', () => {
    const result = ensureClaudeConfig(home);
    expect(result).toEqual({ mcpAdded: true, promptHookAdded: true, stopHookAdded: true });

    const claude = readJson(join(home, '.claude.json'));
    const servers = claude.mcpServers as Record<string, { command: string; args: string[] }>;
    expect(servers.riff?.command).toBe('npx');
    expect(servers.riff?.args).toEqual(['-y', 'riffboard', 'mcp']);

    const settings = JSON.stringify(readJson(join(home, '.claude', 'settings.json')));
    expect(settings).toContain('riffboard hook');
    expect(settings).toContain('riffboard autopush');
  });

  it('is idempotent — a second run adds nothing', () => {
    ensureClaudeConfig(home);
    const again = ensureClaudeConfig(home);
    expect(again).toEqual({ mcpAdded: false, promptHookAdded: false, stopHookAdded: false });

    const settings = readJson(join(home, '.claude', 'settings.json')) as {
      hooks: { UserPromptSubmit: unknown[]; Stop: unknown[] };
    };
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(settings.hooks.Stop).toHaveLength(1);
  });

  it('preserves existing MCP servers and settings', () => {
    writeFileSync(
      join(home, '.claude.json'),
      JSON.stringify({ theme: 'dark', mcpServers: { other: { command: 'other-cmd' } } }),
      'utf8',
    );
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({
        model: 'opus',
        hooks: { Stop: [{ hooks: [{ type: 'command', command: 'existing-stop' }] }] },
      }),
      'utf8',
    );

    ensureClaudeConfig(home);

    const claude = readJson(join(home, '.claude.json'));
    expect(claude.theme).toBe('dark');
    expect((claude.mcpServers as Record<string, unknown>).other).toEqual({ command: 'other-cmd' });
    expect((claude.mcpServers as Record<string, unknown>).riff).toBeDefined();

    const settings = readJson(join(home, '.claude', 'settings.json')) as {
      model: string;
      hooks: { Stop: unknown[] };
    };
    expect(settings.model).toBe('opus');
    expect(settings.hooks.Stop).toHaveLength(2); // existing + ours
  });

  it('registers a local launcher pointing at the running CLI', () => {
    ensureClaudeConfig(home, localLauncher('/abs/dist/cli.js', '/usr/bin/node'));

    const claude = readJson(join(home, '.claude.json'));
    const servers = claude.mcpServers as Record<string, { command: string; args: string[] }>;
    expect(servers.riff?.command).toBe('/usr/bin/node');
    expect(servers.riff?.args).toEqual(['/abs/dist/cli.js', 'mcp']);

    const settings = JSON.stringify(readJson(join(home, '.claude', 'settings.json')));
    expect(settings).toContain('/abs/dist/cli.js');
  });

  it('replaces the Riff entries in place when the launcher changes (no duplicates)', () => {
    ensureClaudeConfig(home); // npx
    ensureClaudeConfig(home, localLauncher('/abs/dist/cli.js', '/usr/bin/node')); // switch to local

    const claude = readJson(join(home, '.claude.json'));
    const servers = claude.mcpServers as Record<string, { command: string }>;
    expect(servers.riff?.command).toBe('/usr/bin/node');

    const settings = readJson(join(home, '.claude', 'settings.json')) as {
      hooks: { UserPromptSubmit: unknown[]; Stop: unknown[] };
    };
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(JSON.stringify(settings)).not.toContain('npx');
  });
});
