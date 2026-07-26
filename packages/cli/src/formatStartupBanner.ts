export type BannerInfo = {
  url: string;
  joinCode: string;
  fingerprint: string;
};

/** Render the human-facing startup banner printed by `riff start`. */
export function formatStartupBanner({ url, joinCode, fingerprint }: BannerInfo): string {
  return [
    '',
    '  🎸 Riff session ready',
    '',
    `  → Open on your network:  ${url}`,
    `  → Join code:             ${joinCode}`,
    `  → Verify fingerprint:    ${fingerprint}`,
    '',
    '  Share the join code with the room. Everyone opens the URL, checks the',
    '  fingerprint matches in their browser, and joins. Press Ctrl-C to stop.',
    '',
  ].join('\n');
}
