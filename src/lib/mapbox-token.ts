/**
 * Read at request time on the server. Next inlines a direct
 * `process.env.NEXT_PUBLIC_*` access at build time, so a token that only
 * exists as `PUBLIC_MAPBOX_ACCESS_TOKEN` never reaches the browser.
 */
export function readMapboxAccessToken(): string {
  const env = process.env as Record<string, string | undefined>;
  for (const name of [
    "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN",
    "PUBLIC_MAPBOX_ACCESS_TOKEN",
  ]) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return "";
}
