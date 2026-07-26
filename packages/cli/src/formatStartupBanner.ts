export type BannerInfo = {
  url: string;
  joinCode: string;
  fingerprint: string;
};

/** Render the human-facing startup banner printed by `riff start`. */
export function formatStartupBanner(_info: BannerInfo): string {
  // TODO(#12): implement.
  throw new Error('formatStartupBanner is not implemented yet (#12)');
}
