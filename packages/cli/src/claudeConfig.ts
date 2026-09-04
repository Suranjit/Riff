/**
 * One-time, idempotent registration of Riff in the user's Claude Code config:
 * the MCP server in `~/.claude.json` and the Riff-button auto-inject
 * `UserPromptSubmit` hook in `~/.claude/settings.json`. Registered commands
 * read `~/.riff/session.json`, so they never need editing again. The launcher
 * (npx vs. local) is pluggable so the flow can be validated before publishing.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hookCommand, npxLauncher, type Launcher } from './launcher.js';

export type EnsureResult = {
  mcpAdded: boolean;
  promptHookAdded: boolean;
};

const HOOK_MARKER = '#riff-hook';
// Marker from the removed auto-push feature; stripped on join for a clean migration.
const STALE_AUTOPUSH_MARKER = '#riff-autopush';

type JsonObject = Record<string, unknown>;
type HookEntry = { hooks: Array<{ type: string; command: string }> };

/**
 * Read an existing config, refusing to continue if it is present but
 * unparseable. Treating a corrupt file as `{}` (the previous behaviour) meant a
 * momentarily malformed ~/.claude.json got rewritten with only Riff's entry,
 * silently destroying every other MCP server and setting the user had.
 */
function readJson(path: string): JsonObject {
  if (!existsSync(path)) return {};
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`${path} could not be read: ${(err as Error).message}`);
  }
  if (raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw) as JsonObject;
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('not a JSON object');
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `${path} is malformed (${(err as Error).message}). ` +
        'Riff will not overwrite it — please fix or move the file, then retry.',
    );
  }
}

/**
 * Write atomically: a partial write here would corrupt the user's Claude Code
 * configuration. Rename within the same directory so it cannot cross devices,
 * and resolve symlinks so a dotfiles-managed config keeps its link.
 */
function writeJson(path: string, value: JsonObject): void {
  mkdirSync(dirname(path), { recursive: true });
  let target = path;
  try {
    if (statSync(path, { throwIfNoEntry: false })?.isFile()) {
      target = realpathSync(path);
    }
  } catch {
    /* fall back to the literal path */
  }
  const tmp = `${target}.riff-${process.pid}.tmp`;
  try {
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, target);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* nothing to clean up */
    }
    throw err;
  }
}

/**
 * Read both Claude config files without writing, so a caller can fail before
 * touching anything. Throws if either exists but cannot be parsed.
 */
export function validateClaudeConfig(homeDir: string): void {
  readJson(join(homeDir, '.claude.json'));
  readJson(join(homeDir, '.claude', 'settings.json'));
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

  // Migration: remove any stale auto-push Stop hook from a past version.
  const stop = hooks.Stop ?? [];
  const nextStop = stripMarked(stop, STALE_AUTOPUSH_MARKER);
  const stopChanged = JSON.stringify(stop) !== JSON.stringify(nextStop);

  if (JSON.stringify(prompt) !== JSON.stringify(nextPrompt) || stopChanged) {
    hooks.UserPromptSubmit = nextPrompt;
    if (stopChanged) {
      if (nextStop.length > 0) hooks.Stop = nextStop;
      else delete hooks.Stop;
    }
    settings.hooks = hooks;
    writeJson(settingsPath, settings);
  }

  return { mcpAdded, promptHookAdded };
}
