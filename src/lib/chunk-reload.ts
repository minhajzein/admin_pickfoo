const CHUNK_ERROR =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;
const RELOAD_KEY = "admin_chunk_reload_at";

/**
 * A JS chunk failed to download (weak network, or a new deploy replaced it).
 * Reload once so the page fetches fresh chunks; a second failure within a
 * minute shows the error screen instead of looping.
 */
export function reloadOnceForChunkError(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  const text =
    error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  if (!CHUNK_ERROR.test(text)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
