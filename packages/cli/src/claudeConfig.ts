/**
 * One-time, idempotent registration of Riff in the user's Claude Code config:
 * the MCP server in `~/.claude.json` and the Riff-button auto-inject
 * `UserPromptSubmit` hook in `~/.claude/settings.json`. Registered commands
 * read `~/.riff/session.json`, so they never need editing again. The launcher
 * (npx vs. local) is pluggable so the flow can be validated before publishing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hookCommand, npxLauncher, type Launcher } from './launcher.js';

export type EnsureResult = {
  mcpAdded: boolean;
  promptHookAdded: boolean;
};

const HOOK_MARKER = '#riff-hook';

type JsonObject = Record<string, unknown>;
type HookEntry = { hooks: Array<{ type: string; command: string }> };

function readJson(path: string): JsonObject {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeJson(path: string, value: JsonObject): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Whether any hook entry carries our marker. */
function hasMarker(entries: HookEntry[], marker: string): boolean {
  return entries.some((entry) =>
    (entry.hooks ?? []).some((h) => typeof h.command === 'string' && h.command.includes(marker)),
  );
}

/** Drop any Riff-owned entries (identified by marker) so we can re-add current ones. */
function stripMarked(entries: HookEntry[], marker: string): HookEntry[] {
  return entries.filter(
    (entry) => !(entry.hooks ?? []).some((h) => (h.command ?? '').includes(marker)),
  );
}

/**
 * Merge the Riff MCP server + auto-inject hook into the Claude Code user config
 * under `homeDir`, preserving everything already there. Safe to run repeatedly;
 * a different `launcher` replaces the Riff entries in place rather than
 * duplicating them.
 */
export function ensureClaudeConfig(
  homeDir: string,
  launcher: Launcher = npxLauncher,
): EnsureResult {
  // --- MCP server in ~/.claude.json ---------------------------------------
  const claudeJsonPath = join(homeDir, '.claude.json');
  const claudeJson = readJson(claudeJsonPath);
  const servers = (claudeJson.mcpServers ?? {}) as JsonObject;
  const mcpAdded = servers.riff === undefined;
  const desiredMcp = { command: launcher.command, args: [...launcher.argsPrefix, 'mcp'] };
  const mcpChanged = JSON.stringify(servers.riff) !== JSON.stringify(desiredMcp);
  if (mcpChanged) {
    servers.riff = desiredMcp;
    claudeJson.mcpServers = servers;
    writeJson(claudeJsonPath, claudeJson);
  }

  // --- UserPromptSubmit hook in ~/.claude/settings.json -------------------
  const settingsPath = join(homeDir, '.claude', 'settings.json');
  const settings = readJson(settingsPath);
  const hooks = (settings.hooks ?? {}) as Record<string, HookEntry[]>;
  const prompt = hooks.UserPromptSubmit ?? [];

  const promptHookAdded = !hasMarker(prompt, HOOK_MARKER);
  const nextPrompt = [
    ...stripMarked(prompt, HOOK_MARKER),
    { hooks: [{ type: 'command', command: hookCommand(launcher, 'hook', HOOK_MARKER) }] },
  ];

  if (JSON.stringify(prompt) !== JSON.stringify(nextPrompt)) {
    hooks.UserPromptSubmit = nextPrompt;
    settings.hooks = hooks;
    writeJson(settingsPath, settings);
  }

  return { mcpAdded, promptHookAdded };
}
