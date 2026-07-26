/**
 * One-time, idempotent registration of Riff in the user's Claude Code config:
 * the MCP server in `~/.claude.json` and the two hooks in
 * `~/.claude/settings.json`. Registered commands are static (`npx -y riffboard
 * …`) and read `~/.riff/session.json`, so they never need editing again.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type EnsureResult = {
  mcpAdded: boolean;
  promptHookAdded: boolean;
  stopHookAdded: boolean;
};

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

/** True if any hook entry in the list runs the given command marker. */
function hasHook(entries: HookEntry[], marker: string): boolean {
  return entries.some((entry) =>
    (entry.hooks ?? []).some((h) => typeof h.command === 'string' && h.command.includes(marker)),
  );
}

/**
 * Merge the Riff MCP server + hooks into the Claude Code user config under
 * `homeDir`, preserving everything already there. Safe to run repeatedly.
 */
export function ensureClaudeConfig(homeDir: string): EnsureResult {
  // --- MCP server in ~/.claude.json ---------------------------------------
  const claudeJsonPath = join(homeDir, '.claude.json');
  const claudeJson = readJson(claudeJsonPath);
  const servers = (claudeJson.mcpServers ?? {}) as JsonObject;
  const mcpAdded = servers.riff === undefined;
  if (mcpAdded) {
    servers.riff = { command: 'npx', args: ['-y', 'riffboard', 'mcp'] };
    claudeJson.mcpServers = servers;
    writeJson(claudeJsonPath, claudeJson);
  }

  // --- Hooks in ~/.claude/settings.json -----------------------------------
  const settingsPath = join(homeDir, '.claude', 'settings.json');
  const settings = readJson(settingsPath);
  const hooks = (settings.hooks ?? {}) as Record<string, HookEntry[]>;
  const prompt = hooks.UserPromptSubmit ?? [];
  const stop = hooks.Stop ?? [];

  const promptHookAdded = !hasHook(prompt, 'riffboard hook');
  if (promptHookAdded) {
    prompt.push({ hooks: [{ type: 'command', command: 'npx -y riffboard hook' }] });
  }
  const stopHookAdded = !hasHook(stop, 'riffboard autopush');
  if (stopHookAdded) {
    stop.push({ hooks: [{ type: 'command', command: 'npx -y riffboard autopush' }] });
  }

  if (promptHookAdded || stopHookAdded) {
    hooks.UserPromptSubmit = prompt;
    hooks.Stop = stop;
    settings.hooks = hooks;
    writeJson(settingsPath, settings);
  }

  return { mcpAdded, promptHookAdded, stopHookAdded };
}
