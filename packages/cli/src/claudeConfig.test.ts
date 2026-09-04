import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

  it('registers the MCP server and the inject hook in a fresh home', () => {
    const result = ensureClaudeConfig(home);
    expect(result).toEqual({ mcpAdded: true, promptHookAdded: true });

    const claude = readJson(join(home, '.claude.json'));
    const servers = claude.mcpServers as Record<string, { command: string; args: string[] }>;
    expect(servers.riff?.command).toBe('npx');
    expect(servers.riff?.args).toEqual(['-y', 'riffboard', 'mcp']);

    const settings = JSON.stringify(readJson(join(home, '.claude', 'settings.json')));
    expect(settings).toContain('riffboard hook');
  });

  it('does NOT register a Stop hook (no auto-push)', () => {
    ensureClaudeConfig(home);
    const settings = JSON.stringify(readJson(join(home, '.claude', 'settings.json')));
    expect(settings).not.toContain('autopush');
    expect(settings).not.toContain('Stop');
  });

  it('cleans up a stale auto-push Stop hook it installed in a past version', () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          Stop: [
            { hooks: [{ type: 'command', command: 'npx -y riffboard autopush #riff-autopush' }] },
            { hooks: [{ type: 'command', command: 'my-own-stop-hook' }] },
          ],
        },
      }),
      'utf8',
    );

    ensureClaudeConfig(home);

    const settings = readJson(join(home, '.claude', 'settings.json')) as {
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> };
    };
    // The stale Riff hook is gone; the user's own Stop hook survives.
    expect(JSON.stringify(settings)).not.toContain('autopush');
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(settings.hooks.Stop[0]?.hooks[0]?.command).toBe('my-own-stop-hook');
  });

  it('is idempotent — a second run adds nothing', () => {
    ensureClaudeConfig(home);
    const again = ensureClaudeConfig(home);
    expect(again).toEqual({ mcpAdded: false, promptHookAdded: false });

    const settings = readJson(join(home, '.claude', 'settings.json')) as {
      hooks: { UserPromptSubmit: unknown[] };
    };
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
  });

  it('preserves existing MCP servers and settings, including any Stop hooks', () => {
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
      hooks: { Stop: unknown[]; UserPromptSubmit: unknown[] };
    };
    expect(settings.model).toBe('opus');
    // Our change never touches Stop hooks: the user's stays, and we add none.
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
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

  it('replaces the inject hook in place when the launcher changes (no duplicates)', () => {
    ensureClaudeConfig(home); // npx
    ensureClaudeConfig(home, localLauncher('/abs/dist/cli.js', '/usr/bin/node')); // switch to local

    const claude = readJson(join(home, '.claude.json'));
    const servers = claude.mcpServers as Record<string, { command: string }>;
    expect(servers.riff?.command).toBe('/usr/bin/node');

    const settings = readJson(join(home, '.claude', 'settings.json')) as {
      hooks: { UserPromptSubmit: unknown[] };
    };
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(JSON.stringify(settings)).not.toContain('npx');
  });

  it('refuses to touch a malformed config rather than replacing it', () => {
    // readJson used to swallow parse errors and return {}, so a momentarily
    // corrupt ~/.claude.json was silently rewritten with only Riff's entry —
    // destroying every other MCP server and setting the user had.
    const path = join(home, '.claude.json');
    const original = '{ "mcpServers": { "other": { "command": "x" } },,, BROKEN';
    writeFileSync(path, original, 'utf8');

    expect(() => ensureClaudeConfig(home)).toThrow(/could not be read|malformed/i);
    expect(readFileSync(path, 'utf8')).toBe(original); // untouched
  });

  it('writes config files with owner-only permissions', () => {
    ensureClaudeConfig(home);
    const mode = statSync(join(home, '.claude.json')).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
