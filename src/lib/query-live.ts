/**
 * Poll only while the tab is visible and the previous request has finished.
 * Overlapping polls on heavy admin endpoints were freezing navigation
 * and exhausting the API process.
 */
export function visibleRefetchInterval(ms: number) {
  return (query: { state: { fetchStatus: string } }) => {
    if (typeof document !== "undefined" && document.hidden) return false;
    if (query.state.fetchStatus === "fetching") return false;
    return ms;
  };
}
